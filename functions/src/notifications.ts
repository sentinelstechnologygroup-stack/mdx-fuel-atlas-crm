/* eslint-disable require-jsdoc */
import {createHash} from "node:crypto";
import {getFirestore} from "firebase-admin/firestore";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";

type EntityData = Record<string, unknown>;

type NotificationRecipient = {
  id: string;
  email: string | null;
  role: string;
  status: string;
  supervisorId: string | null;
};

const LEAD_RECORD_PATH =
  "entities/Lead/records/{leadId}";
const NOTIFICATION_RECORD_PATH =
  "entities/Notification/records";
const SETTINGS_RECORD_PATH =
  "entities/NotificationSettings/records";
const PROFILE_COLLECTION = "userProfiles";

function readString(
  data: EntityData,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeRole(data: EntityData): string {
  const role = readString(
    data,
    "application_role",
    "appRole",
    "role"
  );

  if (role === "admin") {
    return "administrator";
  }

  return role ?? "viewer_support";
}

function normalizeStatus(data: EntityData): string {
  const status = readString(
    data,
    "account_status",
    "accountStatus",
    "status"
  );

  if (status) {
    return status.toLowerCase();
  }

  return data.active === false ? "inactive" : "active";
}

function isActiveRecipient(
  recipient: NotificationRecipient
): boolean {
  return recipient.status === "active";
}

function profileMatches(
  recipient: NotificationRecipient,
  identifier: string | null
): boolean {
  if (!identifier) {
    return false;
  }

  const normalizedIdentifier = identifier.toLowerCase();

  return (
    recipient.id === identifier ||
    recipient.email?.toLowerCase() === normalizedIdentifier
  );
}

function notificationDocumentId(
  leadId: string,
  recipientId: string
): string {
  const digest = createHash("sha256")
    .update(`lead-created:${leadId}:${recipientId}`)
    .digest("hex")
    .slice(0, 40);

  return `lead-created-${digest}`;
}

function leadOwnerIdentifier(
  lead: EntityData
): string | null {
  return readString(
    lead,
    "owner_user_id",
    "ownerId",
    "assigned_user_id",
    "assigned_to_user_id",
    "assigned_to",
    "user_id",
    "created_by_user_id"
  );
}

function leadSupervisorIdentifier(
  lead: EntityData
): string | null {
  return readString(
    lead,
    "assigned_supervisor_user_id",
    "supervisor_user_id",
    "supervisorId"
  );
}

function leadDisplayName(lead: EntityData): string {
  return (
    readString(
      lead,
      "full_name",
      "fullName",
      "company_name",
      "companyName",
      "name"
    ) ?? "New lead"
  );
}

function leadContactDetail(lead: EntityData): string | null {
  return readString(
    lead,
    "phone_number",
    "phone",
    "email"
  );
}

async function loadRecipients():
Promise<NotificationRecipient[]> {
  const snapshot = await getFirestore()
    .collection(PROFILE_COLLECTION)
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data() as EntityData;

    return {
      id: document.id,
      email: readString(data, "email"),
      role: normalizeRole(data),
      status: normalizeStatus(data),
      supervisorId: readString(
        data,
        "supervisor_user_id",
        "supervisorId"
      ),
    };
  });
}

async function loadDisabledPreferenceKeys():
Promise<Set<string>> {
  const snapshot = await getFirestore()
    .collection(SETTINGS_RECORD_PATH)
    .get();
  const disabledKeys = new Set<string>();

  for (const document of snapshot.docs) {
    const data = document.data() as EntityData;

    if (data.notify_new_leads !== false) {
      continue;
    }

    const userId = readString(
      data,
      "user_id",
      "userId"
    );
    const email = readString(data, "user_email", "email");

    if (userId) {
      disabledKeys.add(`id:${userId}`);
    }

    if (email) {
      disabledKeys.add(`email:${email.toLowerCase()}`);
    }
  }

  return disabledKeys;
}

function allowsNewLeadNotifications(
  recipient: NotificationRecipient,
  disabledKeys: Set<string>
): boolean {
  if (disabledKeys.has(`id:${recipient.id}`)) {
    return false;
  }

  if (
    recipient.email &&
    disabledKeys.has(
      `email:${recipient.email.toLowerCase()}`
    )
  ) {
    return false;
  }

  return true;
}

function selectRecipients(
  lead: EntityData,
  profiles: NotificationRecipient[]
): NotificationRecipient[] {
  const activeProfiles = profiles.filter(isActiveRecipient);
  const recipients = new Map<
    string,
    NotificationRecipient
  >();

  const addMatchingProfile = (
    identifier: string | null
  ): NotificationRecipient | null => {
    const profile = activeProfiles.find((candidate) =>
      profileMatches(candidate, identifier)
    );

    if (profile) {
      recipients.set(profile.id, profile);
    }

    return profile ?? null;
  };

  const owner = addMatchingProfile(
    leadOwnerIdentifier(lead)
  );

  const assignedSupervisor =
    leadSupervisorIdentifier(lead);

  if (assignedSupervisor) {
    addMatchingProfile(assignedSupervisor);
  } else if (owner?.supervisorId) {
    addMatchingProfile(owner.supervisorId);
  }

  for (const profile of activeProfiles) {
    if (
      profile.role === "administrator" ||
      profile.role === "super_admin"
    ) {
      recipients.set(profile.id, profile);
    }
  }

  return [...recipients.values()];
}

export async function processNewLeadNotifications(
  leadId: string,
  lead: EntityData,
  eventTime?: string
): Promise<number> {
  if (!lead || typeof lead !== "object") {
    return 0;
  }

  const firestore = getFirestore();
  const [profiles, disabledPreferenceKeys] =
    await Promise.all([
      loadRecipients(),
      loadDisabledPreferenceKeys(),
    ]);

  const recipients = selectRecipients(
    lead,
    profiles
  ).filter((recipient) =>
    allowsNewLeadNotifications(
      recipient,
      disabledPreferenceKeys
    )
  );

  if (recipients.length === 0) {
    return 0;
  }

  const notificationEventId =
    `lead-created-${leadId}`;
  const createdDate =
    eventTime ?? new Date().toISOString();
  const leadName = leadDisplayName(lead);
  const contactDetail = leadContactDetail(lead);
  const message = contactDetail ?
    `${leadName} - ${contactDetail}` :
    leadName;

  return firestore.runTransaction(
    async (transaction) => {
      const candidates = recipients.map((recipient) => {
        const documentId = notificationDocumentId(
          leadId,
          recipient.id
        );
        const reference = firestore
          .collection(NOTIFICATION_RECORD_PATH)
          .doc(documentId);

        return {
          documentId,
          recipient,
          reference,
        };
      });

      const existingDocuments = await Promise.all(
        candidates.map(({reference}) =>
          transaction.get(reference)
        )
      );
      let createdCount = 0;

      candidates.forEach((candidate, index) => {
        if (existingDocuments[index].exists) {
          return;
        }

        const {
          documentId,
          recipient,
          reference,
        } = candidate;

        transaction.create(reference, {
          title: "New lead received",
          message,
          type: "lead",
          related_entity_type: "Lead",
          related_entity_id: leadId,
          user_id: recipient.id,
          user_email: recipient.email,
          is_read: false,
          created_date: createdDate,
          updated_date: createdDate,
          created_by_user_id: "system",
          last_modified_by_user_id: "system",
          notification_source: "lead_on_create",
          notification_event_id: notificationEventId,
          deterministic_key: documentId,
          server_controlled: true,
        });

        createdCount++;
      });

      return createdCount;
    }
  );
}

export const createNewLeadNotifications =
  onDocumentCreated(
    {
      document: LEAD_RECORD_PATH,
      region: "us-central1",
      retry: true,
    },
    async (event) => {
      if (!event.data) {
        return;
      }

      const lead = event.data.data() as
        | EntityData
        | undefined;

      if (!lead) {
        return;
      }

      await processNewLeadNotifications(
        event.params.leadId,
        lead,
        event.time
      );
    }
  );
type NotificationPreferences = {
  notifyTasks: boolean;
  notifyOpportunityClosing: boolean;
  daysBeforeDeadline: number;
};

type ReminderCandidate = {
  sourceType: "Task" | "Opportunity";
  sourceId: string;
  recipient: NotificationRecipient;
  title: string;
  message: string;
  type: "task" | "opportunity";
  runDate: string;
};

const TASK_RECORD_PATH =
  "entities/Task/records";
const OPPORTUNITY_RECORD_PATH =
  "entities/Opportunity/records";
const CENTRAL_TIME_ZONE = "America/Chicago";

function dateKeyInCentralTime(date: Date): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: CENTRAL_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const values = new Map(
    parts.map((part) => [part.type, part.value])
  );

  return [
    values.get("year"),
    values.get("month"),
    values.get("day"),
  ].join("-");
}

function normalizeDateKey(value: unknown): string | null {
  if (typeof value === "string") {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

    return match ? match[0] : null;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return dateKeyInCentralTime(value.toDate());
  }

  return null;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function recordOwnerIdentifier(
  record: EntityData
): string | null {
  return readString(
    record,
    "owner_user_id",
    "ownerId",
    "assigned_user_id",
    "assigned_to_user_id",
    "assigned_to",
    "user_id",
    "created_by_user_id"
  );
}

function taskIsClosed(task: EntityData): boolean {
  const status = (
    readString(task, "status") ?? ""
  ).toLowerCase();

  return new Set([
    "done",
    "completed",
    "cancelled",
    "canceled",
  ]).has(status);
}

function opportunityIsClosed(
  opportunity: EntityData
): boolean {
  const stage = (
    readString(
      opportunity,
      "deal_stage",
      "dealStage",
      "status"
    ) ?? ""
  ).toLowerCase();

  return (
    stage.includes("closed won") ||
    stage.includes("closed lost") ||
    stage === "won" ||
    stage === "lost" ||
    stage === "completed" ||
    stage === "cancelled" ||
    stage === "canceled"
  );
}

function displayText(
  record: EntityData,
  fallback: string,
  ...keys: string[]
): string {
  return readString(record, ...keys) ?? fallback;
}

function preferenceKey(
  prefix: "id" | "email",
  value: string
): string {
  return prefix === "email" ?
    `email:${value.toLowerCase()}` :
    `id:${value}`;
}

function numericDeadlineDays(value: unknown): number {
  const parsed = typeof value === "number" ?
    value :
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 3;
  }

  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

async function loadNotificationPreferences():
Promise<Map<string, NotificationPreferences>> {
  const snapshot = await getFirestore()
    .collection(SETTINGS_RECORD_PATH)
    .get();
  const preferences =
    new Map<string, NotificationPreferences>();

  for (const document of snapshot.docs) {
    const data = document.data() as EntityData;
    const preference: NotificationPreferences = {
      notifyTasks: data.notify_tasks !== false,
      notifyOpportunityClosing:
        data.notify_opp_closing !== false,
      daysBeforeDeadline:
        numericDeadlineDays(data.days_before_deadline),
    };
    const userId = readString(data, "user_id", "userId");
    const email = readString(
      data,
      "user_email",
      "email"
    );

    if (userId) {
      preferences.set(
        preferenceKey("id", userId),
        preference
      );
    }

    if (email) {
      preferences.set(
        preferenceKey("email", email),
        preference
      );
    }
  }

  return preferences;
}

function preferencesForRecipient(
  recipient: NotificationRecipient,
  preferences: Map<string, NotificationPreferences>
): NotificationPreferences {
  const byId = preferences.get(
    preferenceKey("id", recipient.id)
  );

  if (byId) {
    return byId;
  }

  if (recipient.email) {
    const byEmail = preferences.get(
      preferenceKey("email", recipient.email)
    );

    if (byEmail) {
      return byEmail;
    }
  }

  return {
    notifyTasks: true,
    notifyOpportunityClosing: true,
    daysBeforeDeadline: 3,
  };
}

function findActiveOwner(
  record: EntityData,
  profiles: NotificationRecipient[]
): NotificationRecipient | null {
  const identifier = recordOwnerIdentifier(record);

  return profiles.find((profile) =>
    isActiveRecipient(profile) &&
    profileMatches(profile, identifier)
  ) ?? null;
}

function reminderDocumentId(
  candidate: ReminderCandidate
): string {
  const rawKey = [
    candidate.type,
    candidate.sourceId,
    candidate.recipient.id,
    candidate.runDate,
  ].join(":");
  const digest = createHash("sha256")
    .update(rawKey)
    .digest("hex")
    .slice(0, 40);

  return `${candidate.type}-reminder-${digest}`;
}

async function createReminderIfMissing(
  candidate: ReminderCandidate,
  createdDate: string
): Promise<boolean> {
  const firestore = getFirestore();
  const documentId = reminderDocumentId(candidate);
  const reference = firestore
    .collection(NOTIFICATION_RECORD_PATH)
    .doc(documentId);

  return firestore.runTransaction(
    async (transaction) => {
      const existing = await transaction.get(reference);

      if (existing.exists) {
        return false;
      }

      transaction.create(reference, {
        title: candidate.title,
        message: candidate.message,
        type: candidate.type,
        related_entity_type: candidate.sourceType,
        related_entity_id: candidate.sourceId,
        user_id: candidate.recipient.id,
        user_email: candidate.recipient.email,
        is_read: false,
        created_date: createdDate,
        updated_date: createdDate,
        created_by_user_id: "system",
        last_modified_by_user_id: "system",
        notification_source: "daily_reminder_processor",
        notification_event_id: [
          candidate.type,
          candidate.sourceId,
          candidate.runDate,
        ].join(":"),
        notification_run_date: candidate.runDate,
        deterministic_key: documentId,
        server_controlled: true,
      });

      return true;
    }
  );
}

function taskReminderCandidate(
  documentId: string,
  task: EntityData,
  runDate: string,
  profiles: NotificationRecipient[],
  preferences: Map<string, NotificationPreferences>
): ReminderCandidate | null {
  if (taskIsClosed(task)) {
    return null;
  }

  const dueDate = normalizeDateKey(task.due_date);

  if (!dueDate || dueDate > runDate) {
    return null;
  }

  const owner = findActiveOwner(task, profiles);

  if (!owner) {
    return null;
  }

  const ownerPreferences = preferencesForRecipient(
    owner,
    preferences
  );

  if (!ownerPreferences.notifyTasks) {
    return null;
  }

  const taskName = displayText(
    task,
    "Assigned task",
    "title",
    "name"
  );
  const overdue = dueDate < runDate;

  return {
    sourceType: "Task",
    sourceId: documentId,
    recipient: owner,
    title: overdue ? "Task overdue" : "Task due today",
    message: `${taskName} - due ${dueDate}`,
    type: "task",
    runDate,
  };
}

function opportunityReminderCandidate(
  documentId: string,
  opportunity: EntityData,
  runDate: string,
  profiles: NotificationRecipient[],
  preferences: Map<string, NotificationPreferences>
): ReminderCandidate | null {
  if (opportunityIsClosed(opportunity)) {
    return null;
  }

  const closeDate = normalizeDateKey(
    opportunity.expected_close_date
  );

  if (!closeDate || closeDate < runDate) {
    return null;
  }

  const owner = findActiveOwner(opportunity, profiles);

  if (!owner) {
    return null;
  }

  const ownerPreferences = preferencesForRecipient(
    owner,
    preferences
  );

  if (!ownerPreferences.notifyOpportunityClosing) {
    return null;
  }

  const deadline = addDays(
    runDate,
    ownerPreferences.daysBeforeDeadline
  );

  if (closeDate > deadline) {
    return null;
  }

  const opportunityName = displayText(
    opportunity,
    "Opportunity",
    "lead_name",
    "company_name",
    "name",
    "product_type"
  );

  return {
    sourceType: "Opportunity",
    sourceId: documentId,
    recipient: owner,
    title: "Opportunity closing soon",
    message: `${opportunityName} - expected ${closeDate}`,
    type: "opportunity",
    runDate,
  };
}

export async function processDailyReminderNotifications(
  requestedRunDate?: string,
  requestedCreatedDate?: string
): Promise<number> {
  const createdDate =
    requestedCreatedDate ?? new Date().toISOString();
  const runDate =
    normalizeDateKey(requestedRunDate) ??
    dateKeyInCentralTime(new Date(createdDate));
  const firestore = getFirestore();

  const [
    profiles,
    preferences,
    taskSnapshot,
    opportunitySnapshot,
  ] = await Promise.all([
    loadRecipients(),
    loadNotificationPreferences(),
    firestore.collection(TASK_RECORD_PATH).get(),
    firestore.collection(OPPORTUNITY_RECORD_PATH).get(),
  ]);

  const candidates: ReminderCandidate[] = [];

  for (const document of taskSnapshot.docs) {
    const candidate = taskReminderCandidate(
      document.id,
      document.data() as EntityData,
      runDate,
      profiles,
      preferences
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const document of opportunitySnapshot.docs) {
    const candidate = opportunityReminderCandidate(
      document.id,
      document.data() as EntityData,
      runDate,
      profiles,
      preferences
    );

    if (candidate) {
      candidates.push(candidate);
    }
  }

  let createdCount = 0;

  for (const candidate of candidates) {
    if (
      await createReminderIfMissing(
        candidate,
        createdDate
      )
    ) {
      createdCount++;
    }
  }

  return createdCount;
}

export const createDailyReminderNotifications =
  onSchedule(
    {
      schedule: "0 8 * * *",
      timeZone: CENTRAL_TIME_ZONE,
      region: "us-central1",
      retryCount: 3,
    },
    async (event) => {
      await processDailyReminderNotifications(
        undefined,
        event.scheduleTime
      );
    }
  );
