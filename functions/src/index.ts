import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {HttpsError, onCall} from "firebase-functions/v2/https";

setGlobalOptions({maxInstances: 10});

const firebaseAdminApp = getApps().length > 0 ?
  getApps()[0] :
  initializeApp();

const firestore = getFirestore(firebaseAdminApp);

const CANONICAL_ROLES = new Set([
  "super_admin",
  "administrator",
  "supervisor",
  "salesperson",
  "viewer_support",
]);

const ACCOUNT_STATUSES = new Set([
  "invited",
  "active",
  "inactive",
  "suspended",
]);

type ProfileData = Record<string, unknown>;

interface DirectoryUser {
  id: string;
  uid: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  job_title: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  application_role: string;
  account_status: string;
  team_id: string | null;
  supervisor_user_id: string | null;
  territory_ids: string[];
  last_login_date: string | null;
  created_date: string | null;
  updated_date: string | null;
  requested_access_upgrade: boolean;
}

/**
 * Reads the first populated string from compatible profile fields.
 * @param {ProfileData} data Stored employee profile data.
 * @param {...string} keys Compatible profile field names.
 * @return {string|null} The populated string or null.
 */
function readString(
  data: ProfileData,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

/**
 * Reads the first populated string array from compatible profile fields.
 * @param {ProfileData} data Stored employee profile data.
 * @param {...string} keys Compatible profile field names.
 * @return {!Array<string>} The normalized string array.
 */
function readStringArray(
  data: ProfileData,
  ...keys: string[]
): string[] {
  for (const key of keys) {
    const value = data[key];

    if (Array.isArray(value)) {
      return value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      );
    }
  }

  return [];
}

/**
 * Converts supported Firestore or string date values to ISO strings.
 * @param {*} value Stored date value.
 * @return {string|null} The ISO date string or null.
 */
function toIsoString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return null;
}

/**
 * Resolves a profile into one canonical ATLAS application role.
 * @param {ProfileData} data Stored employee profile data.
 * @return {string} The canonical application role.
 */
function normalizeRole(data: ProfileData): string {
  const rawRole = readString(
    data,
    "application_role",
    "appRole",
    "role"
  );

  const mappedRole = rawRole === "admin" ?
    "administrator" :
    rawRole;

  return mappedRole && CANONICAL_ROLES.has(mappedRole) ?
    mappedRole :
    "viewer_support";
}

/**
 * Resolves a profile into one canonical ATLAS account status.
 * @param {ProfileData} data Stored employee profile data.
 * @return {string} The canonical account status.
 */
function normalizeStatus(data: ProfileData): string {
  const rawStatus = readString(
    data,
    "account_status",
    "accountStatus"
  );

  if (rawStatus && ACCOUNT_STATUSES.has(rawStatus)) {
    return rawStatus;
  }

  if (data.active === false) {
    return "inactive";
  }

  return "active";
}

/**
 * Converts a stored employee profile into a directory-safe user record.
 * @param {string} id Firebase Authentication user identifier.
 * @param {ProfileData} data Stored employee profile data.
 * @return {DirectoryUser} The normalized directory user.
 */
function normalizeDirectoryUser(
  id: string,
  data: ProfileData
): DirectoryUser {
  return {
    id,
    uid: id,
    email: readString(data, "email"),
    display_name: readString(
      data,
      "display_name",
      "displayName"
    ),
    full_name: readString(data, "full_name", "fullName"),
    first_name: readString(data, "first_name", "firstName"),
    last_name: readString(data, "last_name", "lastName"),
    phone: readString(data, "phone", "phone_number"),
    job_title: readString(data, "job_title", "jobTitle", "title"),
    photo_url: readString(data, "photo_url", "photoUrl"),
    avatar_url: readString(data, "avatar_url", "avatarUrl"),
    application_role: normalizeRole(data),
    account_status: normalizeStatus(data),
    team_id: readString(data, "team_id", "teamId"),
    supervisor_user_id: readString(
      data,
      "supervisor_user_id",
      "supervisorId"
    ),
    territory_ids: readStringArray(
      data,
      "territory_ids",
      "territoryIds"
    ),
    last_login_date: toIsoString(
      data.last_login_date ?? data.lastLoginDate
    ),
    created_date: toIsoString(
      data.created_date ?? data.created_at
    ),
    updated_date: toIsoString(
      data.updated_date ?? data.updated_at
    ),
    requested_access_upgrade:
      data.requested_access_upgrade === true,
  };
}

/**
 * Loads and validates the authenticated active ATLAS employee profile.
 * @param {string|undefined} uid Authenticated Firebase user identifier.
 * @return {Promise<DirectoryUser>} The validated active employee profile.
 */
async function requireActiveActor(
  uid: string | undefined
): Promise<DirectoryUser> {
  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }

  const profileSnapshot = await firestore
    .collection("userProfiles")
    .doc(uid)
    .get();

  if (!profileSnapshot.exists) {
    throw new HttpsError(
      "permission-denied",
      "An active ATLAS employee profile is required."
    );
  }

  const actor = normalizeDirectoryUser(
    profileSnapshot.id,
    profileSnapshot.data() as ProfileData
  );

  if (actor.account_status !== "active") {
    throw new HttpsError(
      "permission-denied",
      "The ATLAS employee account is not active."
    );
  }

  return actor;
}

export const updateCurrentProfile = onCall(
  async (request) => {
    const actor = await requireActiveActor(
      request.auth?.uid
    );

    const payload =
      request.data &&
      typeof request.data === "object" &&
      !Array.isArray(request.data) ?
        request.data as ProfileData :
        {};

    const payloadKeys = Object.keys(payload);

    if (
      payloadKeys.length !== 1 ||
      payloadKeys[0] !== "full_name"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Only the employee full name may be updated."
      );
    }

    const fullName = readString(
      payload,
      "full_name"
    );

    if (!fullName) {
      throw new HttpsError(
        "invalid-argument",
        "A non-empty employee name is required."
      );
    }

    if (fullName.length > 120) {
      throw new HttpsError(
        "invalid-argument",
        "The employee name cannot exceed 120 characters."
      );
    }

    const profileReference = firestore
      .collection("userProfiles")
      .doc(actor.id);

    await profileReference.set(
      {
        full_name: fullName,
        display_name: fullName,
        fullName: FieldValue.delete(),
        displayName: FieldValue.delete(),
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.delete(),
        last_modified_by_user_id: actor.id,
      },
      {
        merge: true,
      }
    );

    const updatedSnapshot =
      await profileReference.get();

    return {
      user: normalizeDirectoryUser(
        updatedSnapshot.id,
        updatedSnapshot.data() as ProfileData
      ),
      updated_fields: ["full_name"],
    };
  }
);

export const requestAccessUpgrade = onCall(
  async (request) => {
    const actor = await requireActiveActor(
      request.auth?.uid
    );

    const payload =
      request.data &&
      typeof request.data === "object" &&
      !Array.isArray(request.data) ?
        request.data as ProfileData :
        {};

    if (Object.keys(payload).length > 0) {
      throw new HttpsError(
        "invalid-argument",
        "Access-upgrade requests do not accept target data."
      );
    }

    if (actor.requested_access_upgrade) {
      return {
        user: actor,
        request_status: "existing",
      };
    }

    const profileReference = firestore
      .collection("userProfiles")
      .doc(actor.id);

    await profileReference.set(
      {
        requested_access_upgrade: true,
        requested_access_upgrade_at:
          FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.delete(),
        last_modified_by_user_id: actor.id,
      },
      {
        merge: true,
      }
    );

    const updatedSnapshot =
      await profileReference.get();

    return {
      user: normalizeDirectoryUser(
        updatedSnapshot.id,
        updatedSnapshot.data() as ProfileData
      ),
      request_status: "submitted",
    };
  }
);

interface EmployeeLookupUser {
  id: string;
  uid: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  application_role: string;
  account_status: string;
}

/**
 * Converts a directory user into a minimal CRM lookup record.
 * @param {DirectoryUser} user Normalized employee directory user.
 * @return {EmployeeLookupUser} Minimal employee lookup record.
 */
function normalizeEmployeeLookupUser(
  user: DirectoryUser
): EmployeeLookupUser {
  return {
    id: user.id,
    uid: user.uid,
    email: user.email,
    display_name: user.display_name,
    full_name: user.full_name,
    first_name: user.first_name,
    last_name: user.last_name,
    photo_url: user.photo_url,
    avatar_url: user.avatar_url,
    application_role: user.application_role,
    account_status: user.account_status,
  };
}

export const listEmployeeLookup = onCall(
  async (request) => {
    await requireActiveActor(request.auth?.uid);

    const snapshot = await firestore
      .collection("userProfiles")
      .get();

    const users = snapshot.docs
      .map((document) =>
        normalizeDirectoryUser(
          document.id,
          document.data() as ProfileData
        )
      )
      .map(normalizeEmployeeLookupUser);

    users.sort((left, right) => {
      const leftName =
        left.display_name ||
        left.full_name ||
        left.email ||
        left.id;

      const rightName =
        right.display_name ||
        right.full_name ||
        right.email ||
        right.id;

      return leftName.localeCompare(rightName);
    });

    return {
      users,
      scope: "employee_lookup",
    };
  }
);

export const listUsers = onCall(async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const isAdminTier =
    actor.application_role === "super_admin" ||
    actor.application_role === "administrator";
  const isSupervisor = actor.application_role === "supervisor";

  if (!isAdminTier && !isSupervisor) {
    throw new HttpsError(
      "permission-denied",
      "User-directory access is not authorized."
    );
  }

  const snapshot = await firestore.collection("userProfiles").get();

  let users = snapshot.docs.map((document) =>
    normalizeDirectoryUser(
      document.id,
      document.data() as ProfileData
    )
  );

  if (isSupervisor) {
    users = users.filter((user) =>
      user.id === actor.id ||
      (
        actor.team_id !== null &&
        user.team_id === actor.team_id
      )
    );
  }

  users.sort((left, right) => {
    const leftName =
      left.display_name ||
      left.full_name ||
      left.email ||
      left.id;
    const rightName =
      right.display_name ||
      right.full_name ||
      right.email ||
      right.id;

    return leftName.localeCompare(rightName);
  });

  return {
    users,
    scope: isAdminTier ? "all" : "team",
  };
});

const USER_ACCOUNT_ACTIONS = new Set([
  "role",
  "team",
  "supervisor",
  "territory",
  "suspend",
  "reactivate",
]);

export const updateUserAccount = onCall(async (request) => {
  await requireActiveActor(request.auth?.uid);

  const payload =
    request.data &&
    typeof request.data === "object" &&
    !Array.isArray(request.data) ?
      request.data as ProfileData :
      {};

  const action = readString(payload, "action");
  const targetUserId = readString(
    payload,
    "target_user_id",
    "targetUserId"
  );
  const reason = readString(payload, "reason");
  const value = payload.value;

  if (!action || !USER_ACCOUNT_ACTIONS.has(action)) {
    throw new HttpsError(
      "invalid-argument",
      "A supported account action is required."
    );
  }

  if (!targetUserId) {
    throw new HttpsError(
      "invalid-argument",
      "A target employee user identifier is required."
    );
  }

  const result = await firestore.runTransaction(
    async (transaction) => {
      const profilesReference =
        firestore.collection("userProfiles");
      const allProfilesSnapshot =
        await transaction.get(profilesReference);

      const users = allProfilesSnapshot.docs.map((document) =>
        normalizeDirectoryUser(
          document.id,
          document.data() as ProfileData
        )
      );

      const actor = users.find(
        (user) => user.id === request.auth?.uid
      );

      if (!actor || actor.account_status !== "active") {
        throw new HttpsError(
          "permission-denied",
          "An active ATLAS employee profile is required."
        );
      }

      const actorIsSuperAdmin =
        actor.application_role === "super_admin";
      const actorIsAdministrator =
        actor.application_role === "administrator";

      if (!actorIsSuperAdmin && !actorIsAdministrator) {
        throw new HttpsError(
          "permission-denied",
          "User-account administration is not authorized."
        );
      }

      const target = users.find(
        (user) => user.id === targetUserId
      );

      if (!target) {
        throw new HttpsError(
          "not-found",
          "The target employee profile was not found."
        );
      }

      const targetIsAdminTier =
        target.application_role === "super_admin" ||
        target.application_role === "administrator";

      if (actorIsAdministrator && targetIsAdminTier) {
        throw new HttpsError(
          "permission-denied",
          "Administrators cannot manage Administrator-tier accounts."
        );
      }

      const activeSuperAdministrators = users.filter(
        (user) =>
          user.application_role === "super_admin" &&
          user.account_status === "active"
      );

      const targetIsFinalSuperAdministrator =
        target.application_role === "super_admin" &&
        target.account_status === "active" &&
        activeSuperAdministrators.length <= 1;

      const now = new Date().toISOString();
      const update: ProfileData = {
        last_modified_by_user_id: actor.id,
        profile_modified_date: now,
        updated_date: now,
      };

      if (action === "role") {
        if (
          typeof value !== "string" ||
          !CANONICAL_ROLES.has(value)
        ) {
          throw new HttpsError(
            "invalid-argument",
            "A canonical ATLAS role is required."
          );
        }

        if (
          actorIsAdministrator &&
          (
            value === "super_admin" ||
            value === "administrator"
          )
        ) {
          throw new HttpsError(
            "permission-denied",
            "Only a Super Administrator may assign Administrator-tier roles."
          );
        }

        if (
          targetIsFinalSuperAdministrator &&
          value !== "super_admin"
        ) {
          throw new HttpsError(
            "failed-precondition",
            "The final active Super Administrator cannot be demoted."
          );
        }

        update.application_role = value;
        update.appRole = FieldValue.delete();
        update.role = FieldValue.delete();
      }

      if (action === "team") {
        if (
          value !== null &&
          (
            typeof value !== "string" ||
            value.trim().length === 0
          )
        ) {
          throw new HttpsError(
            "invalid-argument",
            "The team value must be a team identifier or null."
          );
        }

        const teamId =
          typeof value === "string" ?
            value.trim() :
            null;

        if (target.supervisor_user_id) {
          const currentSupervisor = users.find(
            (user) =>
              user.id === target.supervisor_user_id
          );

          if (
            currentSupervisor &&
            currentSupervisor.team_id &&
            teamId &&
            currentSupervisor.team_id !== teamId
          ) {
            throw new HttpsError(
              "failed-precondition",
              "Clear or change the supervisor before moving the " +
              "employee to another team."
            );
          }
        }

        update.team_id = teamId;
        update.teamId = FieldValue.delete();
      }

      if (action === "supervisor") {
        if (
          value !== null &&
          (
            typeof value !== "string" ||
            value.trim().length === 0
          )
        ) {
          throw new HttpsError(
            "invalid-argument",
            "The supervisor value must be a user identifier or null."
          );
        }

        const supervisorId =
          typeof value === "string" ?
            value.trim() :
            null;

        if (supervisorId === target.id) {
          throw new HttpsError(
            "failed-precondition",
            "An employee cannot supervise their own account."
          );
        }

        if (supervisorId) {
          const supervisor = users.find(
            (user) => user.id === supervisorId
          );

          if (!supervisor) {
            throw new HttpsError(
              "not-found",
              "The selected supervisor was not found."
            );
          }

          if (supervisor.account_status !== "active") {
            throw new HttpsError(
              "failed-precondition",
              "The selected supervisor is not active."
            );
          }

          if (
            ![
              "supervisor",
              "administrator",
              "super_admin",
            ].includes(supervisor.application_role)
          ) {
            throw new HttpsError(
              "failed-precondition",
              "The selected employee is not authorized to supervise users."
            );
          }

          if (
            target.team_id &&
            supervisor.team_id &&
            target.team_id !== supervisor.team_id
          ) {
            throw new HttpsError(
              "failed-precondition",
              "The supervisor does not manage the employee's assigned team."
            );
          }
        }

        update.supervisor_user_id = supervisorId;
        update.supervisorId = FieldValue.delete();
      }

      if (action === "territory") {
        if (!Array.isArray(value)) {
          throw new HttpsError(
            "invalid-argument",
            "Territory assignments must be an array."
          );
        }

        const territoryValues = value as unknown[];

        if (
          territoryValues.some(
            (item) =>
              typeof item !== "string" ||
              item.trim().length === 0
          )
        ) {
          throw new HttpsError(
            "invalid-argument",
            "Every territory assignment must be a non-empty identifier."
          );
        }

        const territoryIds = Array.from(
          new Set(
            territoryValues.map(
              (item) => (item as string).trim()
            )
          )
        );

        update.territory_ids = territoryIds;
        update.territoryIds = FieldValue.delete();
      }

      if (action === "suspend") {
        if (actor.id === target.id) {
          throw new HttpsError(
            "failed-precondition",
            "Administrators cannot suspend their own account."
          );
        }

        if (!reason) {
          throw new HttpsError(
            "invalid-argument",
            "A suspension reason is required."
          );
        }

        if (targetIsFinalSuperAdministrator) {
          throw new HttpsError(
            "failed-precondition",
            "The final active Super Administrator cannot be suspended."
          );
        }

        update.account_status = "suspended";
        update.accountStatus = FieldValue.delete();
        update.active = FieldValue.delete();
        update.suspension_reason = reason;
        update.suspended_by_user_id = actor.id;
        update.suspended_date = now;
      }

      if (action === "reactivate") {
        update.account_status = "active";
        update.accountStatus = FieldValue.delete();
        update.active = FieldValue.delete();
        update.reactivation_reason = reason;
        update.reactivated_by_user_id = actor.id;
        update.reactivated_date = now;
      }

      const targetReference =
        profilesReference.doc(target.id);

      transaction.update(targetReference, update);

      const auditReference = firestore
        .collection("entities")
        .doc("AuditLog")
        .collection("records")
        .doc();

      transaction.set(auditReference, {
        action: `user_account_${action}`,
        actor_user_id: actor.id,
        actor_email: actor.email,
        target_user_id: target.id,
        target_email: target.email,
        reason: reason ?? null,
        requested_value: value ?? null,
        created_date: now,
        updated_date: now,
      });

      const updatedUser = normalizeDirectoryUser(
        target.id,
        {
          ...(allProfilesSnapshot.docs
            .find((document) => document.id === target.id)
            ?.data() as ProfileData),
          ...update,
        }
      );

      return updatedUser;
    }
  );

  return {
    success: true,
    action,
    user: result,
  };
});
