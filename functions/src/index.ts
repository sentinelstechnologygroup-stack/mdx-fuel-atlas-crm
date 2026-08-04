import ExcelJS from "exceljs";
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

/* eslint-disable require-jsdoc */
const PERMISSION_ACTION_FLAGS = [
  "can_view",
  "can_create",
  "can_edit",
  "can_delete",
  "can_assign",
  "can_export",
  "can_approve",
  "can_manage_configuration",
] as const;

const PERMISSION_MODULE_KEYS = [
  "dashboard",
  "leads",
  "opportunities",
  "tasks",
  "activities",
  "clients",
  "reports",
  "automations",
  "sales_galaxy",
  "atlas",
  "marketing_sequences",
  "marketing_templates",
  "customer_success",
  "imports",
  "exports",
  "duplicate_management",
  "users",
  "teams",
  "territories",
  "roles_permissions",
  "pipeline_configuration",
  "custom_fields",
  "system_tags",
  "workflow_configuration",
  "organization_settings",
  "audit_logs",
  "integrations",
  "security_settings",
] as const;

type PermissionRecord = Record<string, unknown>;

type EffectivePermission = {
  module_key: string;
  record_scope: string;
  source: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_assign: boolean;
  can_export: boolean;
  can_approve: boolean;
  can_manage_configuration: boolean;
};

function permissionString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function permissionMillis(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value && typeof value === "object" && "toMillis" in value) {
    const timestamp = value as {
      toMillis?: () => number;
    };

    if (typeof timestamp.toMillis === "function") {
      return timestamp.toMillis();
    }
  }

  return null;
}

function permissionRecordIsActive(
  record: PermissionRecord,
  now: number,
): boolean {
  const status = permissionString(record.status);

  if (status && status !== "active") {
    return false;
  }

  const effective = permissionMillis(record.effective_date);

  if (effective !== null && effective > now) {
    return false;
  }

  const expiration = permissionMillis(record.expiration_date);

  if (expiration !== null && expiration < now) {
    return false;
  }

  return true;
}

function deniedPermission(moduleKey: string): EffectivePermission {
  return {
    module_key: moduleKey,
    record_scope: "none",
    source: "default_denial",
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
    can_assign: false,
    can_export: false,
    can_approve: false,
    can_manage_configuration: false,
  };
}

function protectedPermission(moduleKey: string): EffectivePermission {
  return {
    module_key: moduleKey,
    record_scope: "all",
    source: "protected_super_admin",
    can_view: true,
    can_create: true,
    can_edit: true,
    can_delete: true,
    can_assign: true,
    can_export: true,
    can_approve: true,
    can_manage_configuration: true,
  };
}

function permissionFromRecord(
  record: PermissionRecord,
  moduleKey: string,
  source: string,
): EffectivePermission {
  const result = deniedPermission(moduleKey);

  result.record_scope = permissionString(record.record_scope) || "none";
  result.source = source;

  for (const flag of PERMISSION_ACTION_FLAGS) {
    result[flag] = record[flag] === true;
  }

  return result;
}

function permissionScopeRank(scope: string): number {
  const ranks: Record<string, number> = {
    none: 0,
    own: 1,
    team: 2,
    all: 3,
  };

  return ranks[scope] ?? 0;
}

function restrictPermission(
  base: EffectivePermission,
  override: PermissionRecord,
  moduleKey: string,
): EffectivePermission {
  const overrideScope = permissionString(override.record_scope) || "none";

  const result: EffectivePermission = {
    ...deniedPermission(moduleKey),
    record_scope:
      permissionScopeRank(base.record_scope) <=
      permissionScopeRank(overrideScope) ?
        base.record_scope :
        overrideScope,
    source: "user_override",
  };

  for (const flag of PERMISSION_ACTION_FLAGS) {
    result[flag] = base[flag] === true && override[flag] === true;
  }

  return result;
}

function resolveEffectivePermission(
  role: string,
  moduleKey: string,
  rolePermission: PermissionRecord | undefined,
  customPermission: PermissionRecord | undefined,
  override: PermissionRecord | undefined,
  now: number,
): EffectivePermission {
  if (role === "super_admin") {
    return protectedPermission(moduleKey);
  }

  let base = deniedPermission(moduleKey);

  if (customPermission) {
    base = permissionFromRecord(customPermission, moduleKey, "custom_role");
  } else if (rolePermission) {
    base = permissionFromRecord(rolePermission, moduleKey, "base_role");
  }

  if (!override || !permissionRecordIsActive(override, now)) {
    return base;
  }

  const mode = permissionString(override.override_mode) || "restrict";

  if (mode === "inherit") {
    return base;
  }

  if (mode === "replace") {
    return permissionFromRecord(override, moduleKey, "user_override");
  }

  return restrictPermission(base, override, moduleKey);
}

function selectPermissionRecord(
  records: PermissionRecord[],
  predicate: (record: PermissionRecord) => boolean,
  now: number,
): PermissionRecord | undefined {
  return records
    .filter(
      (record) => predicate(record) && permissionRecordIsActive(record, now),
    )
    .sort((left, right) => {
      const leftTime =
        permissionMillis(left.updated_date) ??
        permissionMillis(left.effective_date) ??
        0;
      const rightTime =
        permissionMillis(right.updated_date) ??
        permissionMillis(right.effective_date) ??
        0;

      return rightTime - leftTime;
    })[0];
}

/* eslint-enable require-jsdoc */

export const getEffectivePermissions = onCall(async (request) => {
  const actorId = request.auth?.uid;

  await requireActiveActor(actorId);

  if (!actorId) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const payload =
    request.data && typeof request.data === "object" ?
      (request.data as Record<string, unknown>) :
      {};

  const requestedTarget = permissionString(payload.target_user_id);

  const targetUserId = requestedTarget || actorId;

  const actorDocument = await firestore
    .collection("userProfiles")
    .doc(actorId)
    .get();

  const targetDocument =
    targetUserId === actorId ?
      actorDocument :
      await firestore.collection("userProfiles").doc(targetUserId).get();

  if (!targetDocument.exists) {
    throw new HttpsError("not-found", "The requested employee was not found.");
  }

  const actorData = actorDocument.data() || {};
  const targetData = targetDocument.data() || {};

  const actorRole = normalizeRole(actorData);
  const targetRole = normalizeRole(targetData);

  if (
    targetUserId !== actorId &&
    actorRole !== "super_admin" &&
    !(
      actorRole === "administrator" &&
      targetRole !== "super_admin" &&
      targetRole !== "administrator"
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "You cannot inspect this employee's permissions.",
    );
  }

  const targetStatus =
    permissionString(targetData.account_status) || "inactive";

  if (targetStatus !== "active") {
    throw new HttpsError(
      "permission-denied",
      "The requested employee account is inactive.",
    );
  }

  const customRoleId = permissionString(targetData.custom_role_id);

  const [moduleSnapshot, overrideSnapshot] = await Promise.all([
    firestore
      .collection("entities")
      .doc("ModulePermission")
      .collection("records")
      .get(),
    firestore
      .collection("entities")
      .doc("UserPermissionOverride")
      .collection("records")
      .get(),
  ]);

  const moduleRecords = moduleSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  const overrideRecords = overrideSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  const now = Date.now();
  const permissions: Record<string, EffectivePermission> = {};

  for (const moduleKey of PERMISSION_MODULE_KEYS) {
    const basePermission = selectPermissionRecord(
      moduleRecords,
      (record) => {
        const recordModule = permissionString(record.module_key);
        const recordRole =
          permissionString(record.role_key) ||
          permissionString(record.role_type) ||
          permissionString(record.base_role_key);

        return (
          recordModule === moduleKey &&
          recordRole === targetRole &&
          !permissionString(record.custom_role_id) &&
          !permissionString(record.role_definition_id)
        );
      },
      now,
    );

    const customPermission = customRoleId ?
      selectPermissionRecord(
        moduleRecords,
        (record) => {
          const recordModule = permissionString(record.module_key);
          const recordCustomRole =
              permissionString(record.custom_role_id) ||
              permissionString(record.role_definition_id);

          return (
            recordModule === moduleKey && recordCustomRole === customRoleId
          );
        },
        now,
      ) :
      undefined;

    const userOverride = selectPermissionRecord(
      overrideRecords,
      (record) =>
        permissionString(record.user_id) === targetUserId &&
        permissionString(record.module_key) === moduleKey,
      now,
    );

    permissions[moduleKey] = resolveEffectivePermission(
      targetRole,
      moduleKey,
      basePermission,
      customPermission,
      userOverride,
      now,
    );
  }

  let customRoleName: string | null = null;

  if (customRoleId) {
    const roleDocument = await firestore
      .collection("entities")
      .doc("RoleDefinition")
      .collection("records")
      .doc(customRoleId)
      .get();

    if (roleDocument.exists) {
      const roleData = roleDocument.data() || {};

      customRoleName =
        permissionString(roleData.name) ||
        permissionString(roleData.role_name) ||
        null;
    }
  }

  return {
    user_id: targetUserId,
    role_key: targetRole,
    custom_role_id: customRoleId || null,
    custom_role_name: customRoleName,
    permissions,
  };
});

/* eslint-disable require-jsdoc */

type PermissionSeed = {
  record_scope: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_assign: boolean;
  can_export: boolean;
  can_approve: boolean;
  can_manage_configuration: boolean;
};

type PermissionSeedMap = Record<string, PermissionSeed>;

const SYSTEM_ROLE_DEFINITIONS = [
  {
    role_key: "super_admin",
    name: "Super Administrator",
    description:
      "Controls system ownership, administrators, security, and full " +
      "audit access.",
    hierarchy_level: 5,
    is_protected: true,
  },
  {
    role_key: "administrator",
    name: "Administrator",
    description:
      "Controls users below Administrator, configuration, reports, imports, " +
      "exports, and audit access.",
    hierarchy_level: 4,
    is_protected: true,
  },
  {
    role_key: "supervisor",
    name: "Supervisor / Sales Manager",
    description:
      "Manages assigned teams, assignments, pipelines, and team performance.",
    hierarchy_level: 3,
    is_protected: false,
  },
  {
    role_key: "salesperson",
    name: "Salesperson",
    description:
      "Manages assigned leads, opportunities, tasks, and personal pipeline.",
    hierarchy_level: 2,
    is_protected: false,
  },
  {
    role_key: "viewer_support",
    name: "Viewer / Support User",
    description:
      "Receives limited access based on configured module permissions.",
    hierarchy_level: 1,
    is_protected: false,
  },
] as const;

function permissionSeed(
  recordScope: string,
  canView: boolean,
  canCreate: boolean,
  canEdit: boolean,
  canDelete: boolean,
  canAssign: boolean,
  canExport: boolean,
  canApprove: boolean,
  canManageConfiguration: boolean,
): PermissionSeed {
  return {
    record_scope: recordScope,
    can_view: canView,
    can_create: canCreate,
    can_edit: canEdit,
    can_delete: canDelete,
    can_assign: canAssign,
    can_export: canExport,
    can_approve: canApprove,
    can_manage_configuration: canManageConfiguration,
  };
}

const NO_PERMISSION = permissionSeed(
  "none",
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  false,
);

function allPermission(): PermissionSeed {
  return permissionSeed(
    "all",
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  );
}

function permissionSeedMap(
  overrides: PermissionSeedMap,
): PermissionSeedMap {
  const permissions: PermissionSeedMap = {};

  for (const moduleKey of PERMISSION_MODULE_KEYS) {
    permissions[moduleKey] = {
      ...NO_PERMISSION,
    };
  }

  return {
    ...permissions,
    ...overrides,
  };
}

const ADMINISTRATOR_PERMISSION_SEEDS = permissionSeedMap({
  dashboard: permissionSeed(
    "all", true, false, false, false, false, false, false, false
  ),
  leads: permissionSeed(
    "all", true, true, true, false, true, true, false, false
  ),
  opportunities: permissionSeed(
    "all", true, true, true, false, true, true, true, false
  ),
  tasks: permissionSeed(
    "all", true, true, true, false, true, false, false, false
  ),
  activities: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  clients: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  reports: permissionSeed(
    "all", true, false, false, false, false, true, false, false
  ),
  automations: permissionSeed(
    "all", true, true, true, false, false, false, false, true
  ),
  sales_galaxy: permissionSeed(
    "all", true, false, false, false, false, false, false, false
  ),
  atlas: permissionSeed(
    "all", true, false, false, false, false, false, false, false
  ),
  marketing_sequences: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  marketing_templates: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  customer_success: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  imports: permissionSeed(
    "all", true, true, false, false, false, false, false, false
  ),
  exports: permissionSeed(
    "all", true, true, false, false, false, false, false, false
  ),
  duplicate_management: permissionSeed(
    "all", true, true, true, false, false, false, false, false
  ),
  users: permissionSeed(
    "all", true, true, true, false, false, false, false, true
  ),
  teams: permissionSeed(
    "all", true, true, true, false, false, false, false, true
  ),
  territories: permissionSeed(
    "all", true, true, true, false, false, false, false, true
  ),
  roles_permissions: permissionSeed(
    "all", true, false, true, false, false, false, false, false
  ),
  pipeline_configuration: permissionSeed(
    "all", true, false, true, false, false, false, false, true
  ),
  custom_fields: permissionSeed(
    "all", true, false, true, false, false, false, false, true
  ),
  system_tags: permissionSeed(
    "all", true, false, true, false, false, false, false, true
  ),
  workflow_configuration: permissionSeed(
    "all", true, false, true, false, false, false, false, true
  ),
  organization_settings: permissionSeed(
    "all", true, false, true, false, false, false, false, true
  ),
  audit_logs: permissionSeed(
    "all", true, false, false, false, false, true, false, false
  ),
  integrations: permissionSeed(
    "all", true, false, false, false, false, false, false, true
  ),
  security_settings: permissionSeed(
    "none", false, false, false, false, false, false, false, false
  ),
});

const SUPERVISOR_PERMISSION_SEEDS = permissionSeedMap({
  dashboard: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  leads: permissionSeed(
    "team", true, true, true, false, true, false, false, false
  ),
  opportunities: permissionSeed(
    "team", true, true, true, false, true, false, true, false
  ),
  tasks: permissionSeed(
    "team", true, true, true, false, true, false, false, false
  ),
  activities: permissionSeed(
    "team", true, true, true, false, false, false, false, false
  ),
  clients: permissionSeed(
    "team", true, false, true, false, false, false, false, false
  ),
  reports: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  sales_galaxy: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  atlas: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  customer_success: permissionSeed(
    "team", true, false, true, false, false, false, false, false
  ),
  users: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  teams: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
  territories: permissionSeed(
    "team", true, false, false, false, false, false, false, false
  ),
});

const SALESPERSON_PERMISSION_SEEDS = permissionSeedMap({
  dashboard: permissionSeed(
    "own", true, false, false, false, false, false, false, false
  ),
  leads: permissionSeed(
    "own", true, true, true, false, false, false, false, false
  ),
  opportunities: permissionSeed(
    "own", true, true, true, false, false, false, false, false
  ),
  tasks: permissionSeed(
    "own", true, true, true, false, false, false, false, false
  ),
  activities: permissionSeed(
    "own", true, true, true, false, false, false, false, false
  ),
  clients: permissionSeed(
    "own", true, false, false, false, false, false, false, false
  ),
  reports: permissionSeed(
    "own", true, false, false, false, false, false, false, false
  ),
  sales_galaxy: permissionSeed(
    "own", true, false, false, false, false, false, false, false
  ),
  atlas: permissionSeed(
    "own", true, false, false, false, false, false, false, false
  ),
});

const DEFAULT_PERMISSION_SEEDS: Record<string, PermissionSeedMap> = {
  super_admin: permissionSeedMap(
    Object.fromEntries(
      PERMISSION_MODULE_KEYS.map(
        (moduleKey) => [moduleKey, allPermission()]
      )
    )
  ),
  administrator: ADMINISTRATOR_PERMISSION_SEEDS,
  supervisor: SUPERVISOR_PERMISSION_SEEDS,
  salesperson: SALESPERSON_PERMISSION_SEEDS,
  viewer_support: permissionSeedMap({}),
};

export const initializePermissionModel = onCall(
  async (request) => {
    const actor = await requireActiveActor(
      request.auth?.uid
    );

    if (
      actor.application_role !== "super_admin" &&
      actor.application_role !== "administrator"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only administrators may initialize the permission model."
      );
    }

    const result = await firestore.runTransaction(
      async (transaction) => {
        const roleRecordsReference = firestore
          .collection("entities")
          .doc("RoleDefinition")
          .collection("records");

        const permissionRecordsReference = firestore
          .collection("entities")
          .doc("ModulePermission")
          .collection("records");

        const [
          roleSnapshot,
          permissionSnapshot,
        ] = await Promise.all([
          transaction.get(roleRecordsReference),
          transaction.get(permissionRecordsReference),
        ]);

        const activeRoleDocuments = new Map(
          roleSnapshot.docs
            .filter(
              (document) =>
                permissionString(
                  document.data().status
                ) === "active"
            )
            .map(
              (document) => [
                permissionString(
                  document.data().role_key
                ),
                document,
              ]
            )
        );

        const existingPermissionKeys = new Set(
          permissionSnapshot.docs
            .filter(
              (document) =>
                permissionString(
                  document.data().status
                ) === "active"
            )
            .map((document) => {
              const data = document.data();

              return (
                permissionString(data.role_key) +
                "|" +
                permissionString(data.module_key)
              );
            })
        );

        const now = new Date().toISOString();
        let rolesCreated = 0;
        let permissionsCreated = 0;
        const roleDocumentIds = new Map<string, string>();

        for (const definition of SYSTEM_ROLE_DEFINITIONS) {
          const existingDocument =
            activeRoleDocuments.get(definition.role_key);

          if (existingDocument) {
            roleDocumentIds.set(
              definition.role_key,
              existingDocument.id
            );
            continue;
          }

          const roleReference =
            roleRecordsReference.doc();

          transaction.create(roleReference, {
            ...definition,
            role_type: "system",
            base_role_key: null,
            is_system_role: true,
            status: "active",
            created_by_user_id: actor.id,
            last_modified_by_user_id: actor.id,
            created_date: now,
            modified_date: now,
          });

          roleDocumentIds.set(
            definition.role_key,
            roleReference.id
          );
          rolesCreated += 1;
        }

        for (
          const [roleKey, matrix] of
          Object.entries(DEFAULT_PERMISSION_SEEDS)
        ) {
          for (const moduleKey of PERMISSION_MODULE_KEYS) {
            const compositeKey =
              roleKey + "|" + moduleKey;

            if (
              existingPermissionKeys.has(compositeKey)
            ) {
              continue;
            }

            const permissionReference =
              permissionRecordsReference.doc();

            transaction.create(permissionReference, {
              role_key: roleKey,
              module_key: moduleKey,
              ...matrix[moduleKey],
              conditions: {},
              status: "active",
              created_by_user_id: actor.id,
              last_modified_by_user_id: actor.id,
              created_date: now,
              modified_date: now,
            });

            permissionsCreated += 1;
          }
        }

        const auditReference = firestore
          .collection("entities")
          .doc("AuditLog")
          .collection("records")
          .doc();

        transaction.create(auditReference, {
          action: "permission_model_init",
          entity: "PermissionModel",
          entity_id: null,
          actor_user_id: actor.id,
          actor_email: actor.email,
          user_email: actor.email || "system",
          details: JSON.stringify({
            roles_created: rolesCreated,
            permissions_created: permissionsCreated,
            actor_role: actor.application_role,
          }),
          created_date: now,
          updated_date: now,
          timestamp: now,
        });

        return {
          roles_created: rolesCreated,
          permissions_created: permissionsCreated,
        };
      }
    );

    return {
      status: "initialized",
      ...result,
      system_roles:
        Object.keys(DEFAULT_PERMISSION_SEEDS),
      active_modules: PERMISSION_MODULE_KEYS.length,
    };
  }
);

const PERMISSION_OVERRIDE_ACTIONS = new Set([
  "upsert",
  "deactivate",
]);

const PERMISSION_OVERRIDE_MODES = new Set([
  "inherit",
  "replace",
  "restrict",
]);

const PERMISSION_OVERRIDE_SCOPES = new Set([
  "none",
  "own",
  "team",
  "all",
]);

function permissionOverrideDate(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "The expiration date must be an ISO date or null."
    );
  }

  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    throw new HttpsError(
      "invalid-argument",
      "The permission override expiration date is invalid."
    );
  }

  return new Date(milliseconds).toISOString();
}

export const updateUserPermissionOverride = onCall(
  async (request) => {
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
      "targetUserId",
      "user_id",
      "userId"
    );
    const moduleKey = readString(
      payload,
      "module_key",
      "moduleKey"
    );
    const reason = readString(payload, "reason");

    if (
      !action ||
      !PERMISSION_OVERRIDE_ACTIONS.has(action)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "A supported permission override action is required."
      );
    }

    if (!targetUserId) {
      throw new HttpsError(
        "invalid-argument",
        "A target employee user identifier is required."
      );
    }

    if (!moduleKey) {
      throw new HttpsError(
        "invalid-argument",
        "A permission module key is required."
      );
    }

    if (
      !PERMISSION_MODULE_KEYS.some(
        (supportedKey) => supportedKey === moduleKey
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "The permission module key is not supported."
      );
    }

    if (!reason) {
      throw new HttpsError(
        "invalid-argument",
        "A reason for the permission change is required."
      );
    }

    if (reason.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "The permission change reason cannot exceed 500 characters."
      );
    }

    let overrideMode: string | null = null;
    let recordScope: string | null = null;
    let expirationDate: string | null = null;
    const permissionValues: ProfileData = {};

    if (action === "upsert") {
      overrideMode = readString(
        payload,
        "override_mode",
        "overrideMode"
      );
      recordScope = readString(
        payload,
        "record_scope",
        "recordScope"
      );

      if (
        !overrideMode ||
        !PERMISSION_OVERRIDE_MODES.has(overrideMode)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "A supported permission override mode is required."
        );
      }

      if (
        !recordScope ||
        !PERMISSION_OVERRIDE_SCOPES.has(recordScope)
      ) {
        throw new HttpsError(
          "invalid-argument",
          "A supported permission record scope is required."
        );
      }

      for (const flag of PERMISSION_ACTION_FLAGS) {
        const value = payload[flag];

        if (
          value !== undefined &&
          typeof value !== "boolean"
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Permission flag ${flag} must be boolean.`
          );
        }

        permissionValues[flag] = value === true;
      }

      expirationDate = permissionOverrideDate(
        payload.expiration_date ??
        payload.expirationDate
      );
    }

    const result = await firestore.runTransaction(
      async (transaction) => {
        const profilesReference =
          firestore.collection("userProfiles");

        const overrideRecordsReference = firestore
          .collection("entities")
          .doc("UserPermissionOverride")
          .collection("records");

        const [
          profilesSnapshot,
          overridesSnapshot,
        ] = await Promise.all([
          transaction.get(profilesReference),
          transaction.get(overrideRecordsReference),
        ]);

        const users = profilesSnapshot.docs.map(
          (document) =>
            normalizeDirectoryUser(
              document.id,
              document.data() as ProfileData
            )
        );

        const actor = users.find(
          (user) => user.id === request.auth?.uid
        );

        if (
          !actor ||
          actor.account_status !== "active"
        ) {
          throw new HttpsError(
            "permission-denied",
            "An active ATLAS employee profile is required."
          );
        }

        const actorIsSuperAdministrator =
          actor.application_role === "super_admin";
        const actorIsAdministrator =
          actor.application_role === "administrator";

        if (
          !actorIsSuperAdministrator &&
          !actorIsAdministrator
        ) {
          throw new HttpsError(
            "permission-denied",
            "Permission override administration is not authorized."
          );
        }

        if (actor.id === targetUserId) {
          throw new HttpsError(
            "failed-precondition",
            "Administrators cannot manage their own permission overrides."
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

        if (target.account_status !== "active") {
          throw new HttpsError(
            "failed-precondition",
            "Permission overrides require an active target employee."
          );
        }

        const targetIsAdministratorTier =
          target.application_role === "super_admin" ||
          target.application_role === "administrator";

        if (
          actorIsAdministrator &&
          targetIsAdministratorTier
        ) {
          throw new HttpsError(
            "permission-denied",
            "Administrators cannot manage Administrator-tier accounts."
          );
        }

        const matchingOverrides =
          overridesSnapshot.docs.filter((document) => {
            const data =
              document.data() as ProfileData;

            return (
              readString(
                data,
                "user_id",
                "userId",
                "target_user_id",
                "targetUserId"
              ) === target.id &&
              readString(
                data,
                "module_key",
                "moduleKey"
              ) === moduleKey
            );
          });

        if (matchingOverrides.length > 1) {
          throw new HttpsError(
            "failed-precondition",
            "Multiple permission overrides exist for this employee and module."
          );
        }

        if (
          action === "deactivate" &&
          matchingOverrides.length === 0
        ) {
          throw new HttpsError(
            "not-found",
            "The permission override was not found."
          );
        }

        const existingDocument =
          matchingOverrides.length === 1 ?
            matchingOverrides[0] :
            null;

        const overrideReference =
          existingDocument ?
            existingDocument.ref :
            overrideRecordsReference.doc();

        const existingData =
          existingDocument ?
            existingDocument.data() as ProfileData :
            {};

        const now = new Date().toISOString();

        const overrideUpdate: ProfileData = {
          user_id: target.id,
          module_key: moduleKey,
          reason,
          updated_date: now,
          last_modified_by_user_id: actor.id,
        };

        if (!existingDocument) {
          overrideUpdate.created_date = now;
          overrideUpdate.created_by_user_id = actor.id;
        }

        if (action === "upsert") {
          overrideUpdate.override_mode = overrideMode;
          overrideUpdate.record_scope = recordScope;
          overrideUpdate.expiration_date = expirationDate;
          overrideUpdate.effective_date =
            readString(
              existingData,
              "effective_date"
            ) || now;
          overrideUpdate.status = "active";

          if (existingDocument) {
            overrideUpdate.deactivated_date =
              FieldValue.delete();
            overrideUpdate.deactivated_by_user_id =
              FieldValue.delete();
          }

          for (const flag of PERMISSION_ACTION_FLAGS) {
            overrideUpdate[flag] =
              permissionValues[flag] === true;
          }
        } else {
          overrideUpdate.status = "inactive";
          overrideUpdate.deactivated_date = now;
          overrideUpdate.deactivated_by_user_id =
            actor.id;
        }

        transaction.set(
          overrideReference,
          overrideUpdate,
          {
            merge: true,
          }
        );

        const auditReference = firestore
          .collection("entities")
          .doc("AuditLog")
          .collection("records")
          .doc();

        transaction.set(auditReference, {
          action:
            `permission_override_${action}`,
          actor_user_id: actor.id,
          actor_email: actor.email,
          target_user_id: target.id,
          target_email: target.email,
          module_key: moduleKey,
          override_id: overrideReference.id,
          reason,
          requested_value:
            action === "upsert" ?
              {
                override_mode: overrideMode,
                record_scope: recordScope,
                expiration_date: expirationDate,
                ...permissionValues,
              } :
              {
                status: "inactive",
              },
          created_date: now,
          updated_date: now,
        });

        const responseOverride: ProfileData = {
          id: overrideReference.id,
          ...existingData,
          user_id: target.id,
          module_key: moduleKey,
          reason,
          updated_date: now,
          last_modified_by_user_id: actor.id,
          status:
            action === "upsert" ?
              "active" :
              "inactive",
        };

        if (action === "upsert") {
          responseOverride.override_mode =
            overrideMode;
          responseOverride.record_scope =
            recordScope;
          responseOverride.expiration_date =
            expirationDate;
          responseOverride.effective_date =
            readString(
              existingData,
              "effective_date"
            ) || now;

          for (const flag of PERMISSION_ACTION_FLAGS) {
            responseOverride[flag] =
              permissionValues[flag] === true;
          }
        } else {
          responseOverride.deactivated_date = now;
          responseOverride.deactivated_by_user_id =
            actor.id;
        }

        if (!existingDocument) {
          responseOverride.created_date = now;
          responseOverride.created_by_user_id =
            actor.id;
        }

        return {
          action,
          override: responseOverride,
        };
      }
    );

    return {
      success: true,
      ...result,
    };
  }
);

/* eslint-enable require-jsdoc */

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

type EntityData = Record<string, unknown>;

/**
 * Determines whether an employee may modify a scoped record.
 * @param {DirectoryUser} actor Authenticated employee.
 * @param {EntityData} record Stored scoped record.
 * @return {boolean} Whether conversion is authorized.
 */
function canModifyScopedRecord(
  actor: DirectoryUser,
  record: EntityData
): boolean {
  if (
    actor.application_role === "super_admin" ||
    actor.application_role === "administrator"
  ) {
    return true;
  }

  const ownerUserId = readString(
    record,
    "owner_user_id",
    "ownerId"
  );

  if (actor.application_role === "salesperson") {
    return ownerUserId === actor.id;
  }

  if (actor.application_role !== "supervisor") {
    return false;
  }

  const assignedTeamId = readString(
    record,
    "assigned_team_id",
    "teamId"
  );
  const assignedSupervisorId = readString(
    record,
    "assigned_supervisor_user_id",
    "supervisorId"
  );

  return (
    ownerUserId === actor.id ||
    assignedSupervisorId === actor.id ||
    (
      actor.team_id !== null &&
      assignedTeamId === actor.team_id
    )
  );
}

/**
 * Merges document arrays and removes duplicate URLs.
 * @param {...unknown} values Potential document arrays.
 * @return {!Array<EntityData>} Unique document records.
 */
function mergeEntityDocuments(
  ...values: unknown[]
): EntityData[] {
  const documents = values
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter(
      (value): value is EntityData =>
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );

  const seen = new Set<string>();

  return documents.filter((document) => {
    const url = readString(document, "url");
    const key = url ?? JSON.stringify(document);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* eslint-disable require-jsdoc */

const REPORT_TIME_RANGES = new Set([
  "today",
  "this_week",
  "this_month",
  "last_month",
  "this_year",
  "all",
]);

const REPORT_ENTITY_BY_ID: Record<string, string> = {
  list: "Opportunity",
  advanced: "Opportunity",
  sales: "Opportunity",
  forecast: "Opportunity",
  conversion: "Lead",
  sources: "Lead",
  activity: "Activity",
};

type ReportCellValue = string | number | boolean;

interface ReportDateRange {
  start: number | null;
  end: number | null;
}

interface ReportWorkbookData {
  sheetName: string;
  columns: Array<{
    header: string;
    key: string;
    width: number;
  }>;
  rows: Array<Record<string, ReportCellValue>>;
}

function reportDateRange(
  timeRange: string,
  currentDate: Date
): ReportDateRange {
  const year = currentDate.getUTCFullYear();
  const month = currentDate.getUTCMonth();
  const day = currentDate.getUTCDate();

  switch (timeRange) {
  case "today":
    return {
      start: Date.UTC(year, month, day),
      end: null,
    };

  case "this_week": {
    const start = new Date(
      Date.UTC(year, month, day)
    );

    start.setUTCDate(
      start.getUTCDate() - start.getUTCDay()
    );

    return {
      start: start.getTime(),
      end: null,
    };
  }

  case "this_month":
    return {
      start: Date.UTC(year, month, 1),
      end: null,
    };

  case "last_month":
    return {
      start: Date.UTC(year, month - 1, 1),
      end: Date.UTC(year, month, 1) - 1,
    };

  case "this_year":
    return {
      start: Date.UTC(year, 0, 1),
      end: null,
    };

  default:
    return {
      start: null,
      end: null,
    };
  }
}

function reportDateMillis(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? null : parsed;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>;
    const seconds =
      typeof record.seconds === "number" ?
        record.seconds :
        typeof record._seconds === "number" ?
          record._seconds :
          null;

    if (seconds !== null) {
      return seconds * 1000;
    }
  }

  return null;
}

function reportDateText(value: unknown): string {
  const milliseconds = reportDateMillis(value);

  if (milliseconds === null) {
    return "";
  }

  return new Date(milliseconds).toISOString();
}

function reportCell(value: unknown): ReportCellValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  const dateText = reportDateText(value);

  if (dateText) {
    return dateText;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function reportRecordOwnerId(
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

function canViewReportRecord(
  actor: DirectoryUser,
  record: EntityData,
  recordScope: string
): boolean {
  if (recordScope === "all") {
    return true;
  }

  const ownerUserId = reportRecordOwnerId(record);
  const ownsRecord = ownerUserId === actor.id;

  if (recordScope === "own") {
    return ownsRecord;
  }

  if (recordScope !== "team") {
    return false;
  }

  const assignedTeamId = readString(
    record,
    "assigned_team_id",
    "team_id",
    "teamId"
  );
  const assignedSupervisorId = readString(
    record,
    "assigned_supervisor_user_id",
    "supervisor_user_id",
    "supervisorId"
  );

  return (
    ownsRecord ||
    assignedSupervisorId === actor.id ||
    (
      actor.team_id !== null &&
      assignedTeamId === actor.team_id
    )
  );
}

async function resolveActorModulePermission(
  actor: DirectoryUser,
  moduleKey: string
): Promise<EffectivePermission> {
  if (actor.application_role === "super_admin") {
    return protectedPermission(moduleKey);
  }

  const actorDocument = await firestore
    .collection("userProfiles")
    .doc(actor.id)
    .get();

  const actorData =
    (actorDocument.data() || {}) as ProfileData;

  const customRoleId = readString(
    actorData,
    "custom_role_id"
  );

  const [
    moduleSnapshot,
    overrideSnapshot,
  ] = await Promise.all([
    firestore
      .collection("entities")
      .doc("ModulePermission")
      .collection("records")
      .get(),
    firestore
      .collection("entities")
      .doc("UserPermissionOverride")
      .collection("records")
      .get(),
  ]);

  const moduleRecords = moduleSnapshot.docs.map(
    (document) => ({
      id: document.id,
      ...document.data(),
    })
  );

  const overrideRecords = overrideSnapshot.docs.map(
    (document) => ({
      id: document.id,
      ...document.data(),
    })
  );

  const now = Date.now();

  const basePermission = selectPermissionRecord(
    moduleRecords,
    (record) => {
      const recordModule =
        permissionString(record.module_key);
      const recordRole =
        permissionString(record.role_key) ||
        permissionString(record.role_type) ||
        permissionString(record.base_role_key);

      return (
        recordModule === moduleKey &&
        recordRole === actor.application_role &&
        !permissionString(record.custom_role_id) &&
        !permissionString(record.role_definition_id)
      );
    },
    now
  );

  const customPermission = customRoleId ?
    selectPermissionRecord(
      moduleRecords,
      (record) => {
        const recordModule =
          permissionString(record.module_key);
        const recordCustomRole =
          permissionString(record.custom_role_id) ||
          permissionString(record.role_definition_id);

        return (
          recordModule === moduleKey &&
          recordCustomRole === customRoleId
        );
      },
      now
    ) :
    undefined;

  const userOverride = selectPermissionRecord(
    overrideRecords,
    (record) =>
      permissionString(record.user_id) === actor.id &&
      permissionString(record.module_key) === moduleKey,
    now
  );

  return resolveEffectivePermission(
    actor.application_role,
    moduleKey,
    basePermission,
    customPermission,
    userOverride,
    now
  );
}

function reportWorkbookData(
  entityName: string,
  records: EntityData[],
  actor: DirectoryUser
): ReportWorkbookData {
  if (entityName === "Lead") {
    return {
      sheetName: "Leads",
      columns: [
        {header: "ID", key: "id", width: 24},
        {header: "Name", key: "name", width: 30},
        {header: "Email", key: "email", width: 32},
        {header: "Phone", key: "phone", width: 20},
        {header: "Status", key: "status", width: 18},
        {header: "Source Year", key: "sourceYear", width: 14},
        {header: "City", key: "city", width: 22},
        {header: "Created Date", key: "createdDate", width: 26},
      ],
      rows: records.map((record) => ({
        id: reportCell(record.id),
        name: reportCell(record.full_name),
        email: reportCell(record.email),
        phone: reportCell(record.phone_number),
        status: reportCell(record.lead_status),
        sourceYear: reportCell(record.source_year),
        city: reportCell(record.city),
        createdDate: reportDateText(record.created_date),
      })),
    };
  }

  if (entityName === "Activity") {
    return {
      sheetName: "Activities",
      columns: [
        {header: "ID", key: "id", width: 24},
        {header: "Type", key: "type", width: 18},
        {header: "Status", key: "status", width: 18},
        {header: "Date", key: "date", width: 26},
        {header: "Summary", key: "summary", width: 45},
        {header: "Lead ID", key: "leadId", width: 24},
        {header: "Created Date", key: "createdDate", width: 26},
      ],
      rows: records.map((record) => ({
        id: reportCell(record.id),
        type: reportCell(record.type),
        status: reportCell(record.status),
        date: reportDateText(record.date),
        summary: reportCell(record.summary),
        leadId: reportCell(record.lead_id),
        createdDate: reportDateText(record.created_date),
      })),
    };
  }

  return {
    sheetName: "Opportunities",
    columns: [
      {header: "ID", key: "id", width: 24},
      {header: "Lead Name", key: "leadName", width: 30},
      {header: "Product", key: "product", width: 24},
      {header: "Stage", key: "stage", width: 20},
      {header: "Amount", key: "amount", width: 16},
      {header: "Probability", key: "probability", width: 14},
      {header: "Close Date", key: "closeDate", width: 26},
      {header: "Created Date", key: "createdDate", width: 26},
      {header: "Owner", key: "owner", width: 30},
    ],
    rows: records.map((record) => ({
      id: reportCell(record.id),
      leadName: reportCell(record.lead_name),
      product: reportCell(record.product_type),
      stage: reportCell(record.deal_stage),
      amount: reportCell(record.amount),
      probability: reportCell(record.probability),
      closeDate: reportDateText(record.expected_close_date),
      createdDate: reportDateText(record.created_date),
      owner: reportCell(
        readString(
          record,
          "owner",
          "owner_name"
        ) || actor.email || ""
      ),
    })),
  };
}

/**
 * Exports an authorized, record-scoped CRM report as an Excel workbook.
 */
export const exportReport = onCall(async (request) => {
  const actor = await requireActiveActor(
    request.auth?.uid
  );

  const payload =
    request.data &&
    typeof request.data === "object" &&
    !Array.isArray(request.data) ?
      request.data as EntityData :
      {};

  const reportId = readString(
    payload,
    "reportId",
    "report_id"
  );
  const timeRange =
    readString(
      payload,
      "timeRange",
      "time_range"
    ) || "all";

  if (!reportId || !REPORT_ENTITY_BY_ID[reportId]) {
    throw new HttpsError(
      "invalid-argument",
      "A supported report identifier is required."
    );
  }

  if (!REPORT_TIME_RANGES.has(timeRange)) {
    throw new HttpsError(
      "invalid-argument",
      "A supported report time range is required."
    );
  }

  const permission =
    await resolveActorModulePermission(
      actor,
      "reports"
    );

  if (
    permission.can_view !== true ||
    permission.can_export !== true ||
    permission.record_scope === "none"
  ) {
    throw new HttpsError(
      "permission-denied",
      "Report export permission is required."
    );
  }

  const entityName =
    REPORT_ENTITY_BY_ID[reportId];

  const snapshot = await firestore
    .collection("entities")
    .doc(entityName)
    .collection("records")
    .get();

  const dateField =
    entityName === "Activity" ?
      "date" :
      "created_date";

  const range = reportDateRange(
    timeRange,
    new Date()
  );

  const visibleRecords = snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    }))
    .filter((record) =>
      canViewReportRecord(
        actor,
        record,
        permission.record_scope
      )
    )
    .filter((record) => {
      if (range.start === null) {
        return true;
      }

      const recordDate =
        reportDateMillis((record as EntityData)[dateField]);

      if (recordDate === null) {
        return false;
      }

      return (
        recordDate >= range.start &&
        (
          range.end === null ||
          recordDate <= range.end
        )
      );
    });

  const workbookData = reportWorkbookData(
    entityName,
    visibleRecords,
    actor
  );

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "MDX Fuel ATLAS CRM";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(
    workbookData.sheetName
  );

  worksheet.columns = workbookData.columns;
  worksheet.addRows(workbookData.rows);
  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const headerRow = worksheet.getRow(1);

  headerRow.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF1F2937",
    },
  };

  const workbookBuffer =
    await workbook.xlsx.writeBuffer();

  if (workbookBuffer.byteLength > 7000000) {
    throw new HttpsError(
      "resource-exhausted",
      "The report is too large to export in one workbook."
    );
  }

  return {
    file: Buffer.from(workbookBuffer).toString("base64"),
    filename:
      `${workbookData.sheetName}_${timeRange}.xlsx`,
    row_count: workbookData.rows.length,
  };
});

/* eslint-enable require-jsdoc */

/**
 * Converts an authorized lead into one opportunity.
 */

const REASSIGNMENT_ENTITIES = {
  lead: {
    collection: "Lead",
    module: "leads",
  },
  opportunity: {
    collection: "Opportunity",
    module: "opportunities",
  },
  task: {
    collection: "Task",
    module: "tasks",
  },
  activity: {
    collection: "Activity",
    module: "activities",
  },
  client: {
    collection: "Client",
    module: "clients",
  },
} as const;

type ReassignmentEntityType =
  keyof typeof REASSIGNMENT_ENTITIES;

/**
 * Validates and normalizes a required reassignment identifier.
 * @param {unknown} value Candidate identifier.
 * @param {string} label Human-readable field label.
 * @return {string} Normalized identifier.
 */
function requiredReassignmentId(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      label + " is required.",
    );
  }

  const result = value.trim();

  if (
    !result ||
    result.length > 160 ||
    !/^[A-Za-z0-9_-]+$/.test(result)
  ) {
    throw new HttpsError(
      "invalid-argument",
      label + " is invalid.",
    );
  }

  return result;
}

/**
 * Validates and normalizes an optional reassignment identifier.
 * @param {unknown} value Candidate identifier.
 * @param {string} label Human-readable field label.
 * @return {string|null} Normalized identifier or null.
 */
function optionalReassignmentId(
  value: unknown,
  label: string,
): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requiredReassignmentId(value, label);
}

/**
 * Validates and normalizes optional reassignment text.
 * @param {unknown} value Candidate text.
 * @param {string} label Human-readable field label.
 * @param {number} maximumLength Maximum permitted length.
 * @return {string|null} Normalized text or null.
 */
function optionalReassignmentText(
  value: unknown,
  label: string,
  maximumLength: number,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpsError(
      "invalid-argument",
      label + " must be text.",
    );
  }

  const result = value.trim();

  if (result.length > maximumLength) {
    throw new HttpsError(
      "invalid-argument",
      label + " is too long.",
    );
  }

  return result || null;
}

export const reassignRecord = onCall(async (request) => {
  const actor = await requireActiveActor(request.auth?.uid);
  const data = (request.data || {}) as Record<string, unknown>;

  const rawEntityType =
    typeof data.entity_type === "string" ?
      data.entity_type.trim().toLowerCase() :
      "";

  if (!(rawEntityType in REASSIGNMENT_ENTITIES)) {
    throw new HttpsError(
      "invalid-argument",
      "A supported entity type is required.",
    );
  }

  const entityType = rawEntityType as ReassignmentEntityType;
  const configuration = REASSIGNMENT_ENTITIES[entityType];

  const entityId = requiredReassignmentId(
    data.entity_id,
    "The entity identifier",
  );
  const targetOwnerId = requiredReassignmentId(
    data.to_owner_user_id,
    "The destination owner",
  );
  const requestedTeamId = optionalReassignmentId(
    data.to_team_id,
    "The destination team",
  );
  const requestedSupervisorId = optionalReassignmentId(
    data.to_supervisor_user_id,
    "The destination supervisor",
  );
  const operationId = requiredReassignmentId(
    data.transfer_operation_id,
    "The transfer operation identifier",
  );
  const transferReason = optionalReassignmentText(
    data.transfer_reason,
    "The transfer reason",
    500,
  );
  const transferType =
    optionalReassignmentText(
      data.transfer_type,
      "The transfer type",
      40,
    ) || "manual";

  if (!/^[a-z][a-z0-9_-]*$/.test(transferType)) {
    throw new HttpsError(
      "invalid-argument",
      "The transfer type is invalid.",
    );
  }

  const permission = await resolveActorModulePermission(
    actor,
    configuration.module,
  );

  if (
    permission.can_assign !== true ||
    permission.record_scope === "none"
  ) {
    throw new HttpsError(
      "permission-denied",
      "You are not authorized to assign these records.",
    );
  }

  const recordReference = firestore
    .collection("entities")
    .doc(configuration.collection)
    .collection("records")
    .doc(entityId);

  const targetOwnerReference = firestore
    .collection("userProfiles")
    .doc(targetOwnerId);

  const auditReference = firestore
    .collection("entities")
    .doc("AuditLog")
    .collection("records")
    .doc("ownership-transfer-" + operationId);

  return firestore.runTransaction(async (transaction) => {
    const [
      recordSnapshot,
      targetOwnerSnapshot,
      auditSnapshot,
    ] = await Promise.all([
      transaction.get(recordReference),
      transaction.get(targetOwnerReference),
      transaction.get(auditReference),
    ]);

    if (auditSnapshot.exists) {
      const priorAudit =
        (auditSnapshot.data() || {}) as Record<string, unknown>;

      if (
        permissionString(priorAudit.entity_type) !== entityType ||
        permissionString(priorAudit.entity_id) !== entityId
      ) {
        throw new HttpsError(
          "already-exists",
          "The transfer operation identifier is already in use.",
        );
      }

      return {
        success: true,
        status: "already_processed",
        entity_type: entityType,
        entity_id: entityId,
        transfer_operation_id: operationId,
      };
    }

    if (!recordSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "The requested CRM record was not found.",
      );
    }

    if (!targetOwnerSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "The destination employee was not found.",
      );
    }

    const record =
      (recordSnapshot.data() || {}) as Record<string, unknown>;

    const canModifySourceRecord =
      canModifyScopedRecord(actor, record) &&
      canViewReportRecord(
        actor,
        record,
        permission.record_scope,
      );

    if (!canModifySourceRecord) {
      throw new HttpsError(
        "permission-denied",
        "The requested record is outside your authorized scope.",
      );
    }

    const targetOwner = normalizeDirectoryUser(
      targetOwnerSnapshot.id,
      targetOwnerSnapshot.data() as ProfileData,
    );

    if (targetOwner.account_status !== "active") {
      throw new HttpsError(
        "failed-precondition",
        "The destination employee account is not active.",
      );
    }

    const destinationTeamId =
      requestedTeamId ?? targetOwner.team_id;

    const destinationSupervisorId =
      requestedSupervisorId ??
      targetOwner.supervisor_user_id;

    const teamReference = destinationTeamId ?
      firestore
        .collection("entities")
        .doc("Team")
        .collection("records")
        .doc(destinationTeamId) :
      null;

    const supervisorReference = destinationSupervisorId ?
      firestore
        .collection("userProfiles")
        .doc(destinationSupervisorId) :
      null;

    const teamSnapshot = teamReference ?
      await transaction.get(teamReference) :
      null;

    const supervisorSnapshot = supervisorReference ?
      await transaction.get(supervisorReference) :
      null;

    if (teamSnapshot && !teamSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "The destination team was not found.",
      );
    }

    let destinationSupervisor: DirectoryUser | null = null;

    if (supervisorReference) {
      if (!supervisorSnapshot || !supervisorSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "The destination supervisor was not found.",
        );
      }

      destinationSupervisor = normalizeDirectoryUser(
        supervisorSnapshot.id,
        supervisorSnapshot.data() as ProfileData,
      );

      if (destinationSupervisor.account_status !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "The destination supervisor is not active.",
        );
      }

      if (
        ![
          "super_admin",
          "administrator",
          "supervisor",
        ].includes(destinationSupervisor.application_role)
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The selected employee cannot supervise records.",
        );
      }

      if (
        destinationTeamId &&
        destinationSupervisor.team_id &&
        destinationSupervisor.team_id !== destinationTeamId
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The supervisor does not manage the destination team.",
        );
      }
    }

    if (
      destinationTeamId &&
      targetOwner.team_id &&
      targetOwner.team_id !== destinationTeamId
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The owner does not belong to the destination team.",
      );
    }

    if (
      permission.record_scope !== "all" &&
      actor.team_id !== destinationTeamId
    ) {
      throw new HttpsError(
        "permission-denied",
        "You cannot transfer a record outside your team.",
      );
    }

    const now = new Date().toISOString();

    const previousOwnership = {
      owner_user_id:
        readString(record, "owner_user_id", "ownerId"),
      assigned_team_id:
        readString(record, "assigned_team_id", "teamId"),
      assigned_supervisor_user_id: readString(
        record,
        "assigned_supervisor_user_id",
        "supervisorId",
      ),
      territory_id:
        readString(record, "territory_id", "territoryId"),
      ownership_status:
        readString(record, "ownership_status"),
    };

    const updatedOwnership = {
      owner_user_id: targetOwner.id,
      assigned_team_id: destinationTeamId,
      assigned_supervisor_user_id:
        destinationSupervisorId,
      territory_id:
        previousOwnership.territory_id || null,
      ownership_status: "assigned",
    };

    transaction.update(recordReference, {
      ...updatedOwnership,
      assigned_by_user_id: actor.id,
      assignment_date: now,
      last_modified_by_user_id: actor.id,
      updated_date: now,
      ownerId: FieldValue.delete(),
      teamId: FieldValue.delete(),
      supervisorId: FieldValue.delete(),
      territoryId: FieldValue.delete(),
    });

    transaction.create(auditReference, {
      action_type: "record_reassigned",
      actor_user_id: actor.id,
      actor_email: actor.email,
      entity_type: entityType,
      entity_collection: configuration.collection,
      entity_id: entityId,
      transfer_operation_id: operationId,
      transfer_type: transferType,
      transfer_reason: transferReason,
      previous_value: previousOwnership,
      new_value: updatedOwnership,
      created_date: now,
      created_by_user_id: actor.id,
      immutable: true,
    });

    return {
      success: true,
      status: "completed",
      entity_type: entityType,
      entity_id: entityId,
      transfer_operation_id: operationId,
      ownership: updatedOwnership,
    };
  });
});

export const convertLeadToOpportunity = onCall(
  async (request) => {
    const actor = await requireActiveActor(
      request.auth?.uid
    );

    const payload =
      request.data &&
      typeof request.data === "object" &&
      !Array.isArray(request.data) ?
        request.data as EntityData :
        {};

    if (
      Object.keys(payload).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(
        payload,
        "leadId"
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Only a leadId may be supplied."
      );
    }

    const leadId = readString(
      payload,
      "leadId"
    );

    if (
      !leadId ||
      leadId.includes("/") ||
      leadId.length > 1200
    ) {
      throw new HttpsError(
        "invalid-argument",
        "A valid lead identifier is required."
      );
    }

    const result = await firestore.runTransaction(
      async (transaction) => {
        const entitiesReference =
          firestore.collection("entities");

        const leadReference =
          entitiesReference
            .doc("Lead")
            .collection("records")
            .doc(leadId);

        const opportunitiesReference =
          entitiesReference
            .doc("Opportunity")
            .collection("records");

        const deterministicOpportunityReference =
          opportunitiesReference.doc(
            "lead-" + leadId
          );

        const existingOpportunityQuery =
          opportunitiesReference
            .where("lead_id", "==", leadId)
            .limit(2);

        const [
          leadSnapshot,
          deterministicOpportunitySnapshot,
          existingOpportunitySnapshot,
        ] = await Promise.all([
          transaction.get(leadReference),
          transaction.get(
            deterministicOpportunityReference
          ),
          transaction.get(existingOpportunityQuery),
        ]);

        if (!leadSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The lead was not found."
          );
        }

        const lead =
          leadSnapshot.data() as EntityData;

        if (lead.is_deleted === true) {
          throw new HttpsError(
            "failed-precondition",
            "An archived lead cannot be converted."
          );
        }

        if (!canModifyScopedRecord(actor, lead)) {
          throw new HttpsError(
            "permission-denied",
            "Lead conversion is not authorized."
          );
        }

        const existingOpportunities =
          new Map<string, EntityData>();

        if (
          deterministicOpportunitySnapshot.exists
        ) {
          existingOpportunities.set(
            deterministicOpportunitySnapshot.id,
            deterministicOpportunitySnapshot.data() as EntityData
          );
        }

        for (
          const document of
          existingOpportunitySnapshot.docs
        ) {
          existingOpportunities.set(
            document.id,
            document.data() as EntityData
          );
        }

        if (existingOpportunities.size > 1) {
          throw new HttpsError(
            "failed-precondition",
            "Multiple opportunities already reference this lead."
          );
        }

        const existingOpportunity =
          Array.from(
            existingOpportunities.entries()
          )[0];

        const nowIso = new Date().toISOString();

        if (existingOpportunity) {
          const [
            existingOpportunityId,
            existingOpportunityData,
          ] = existingOpportunity;

          if (
            readString(
              existingOpportunityData,
              "lead_id",
              "leadId"
            ) !== leadId
          ) {
            throw new HttpsError(
              "already-exists",
              "The deterministic opportunity identifier is in use."
            );
          }

          transaction.update(leadReference, {
            lead_status: "Converted",
            converted_opportunity_id:
              existingOpportunityId,
            converted_date:
              readString(
                lead,
                "converted_date"
              ) || nowIso,
            updated_date: nowIso,
            last_modified_by_user_id: actor.id,
          });

          return {
            opportunityId:
              existingOpportunityId,
            created: false,
            opportunity: {
              id: existingOpportunityId,
              ...existingOpportunityData,
            },
          };
        }

        const fullName =
          readString(
            lead,
            "full_name",
            "fullName"
          ) || "Unnamed Lead";

        const ownerUserId = readString(
          lead,
          "owner_user_id",
          "ownerId"
        );

        const assignedTeamId = readString(
          lead,
          "assigned_team_id",
          "teamId"
        );

        const assignedSupervisorId =
          readString(
            lead,
            "assigned_supervisor_user_id",
            "supervisorId"
          );

        const territoryId = readString(
          lead,
          "territory_id",
          "territoryId"
        );

        const opportunityData: EntityData = {
          lead_id: leadId,
          lead_name: fullName,
          phone_number: readString(
            lead,
            "phone_number",
            "phone"
          ),
          email: readString(
            lead,
            "email"
          ),
          product_type:
            readString(
              lead,
              "product_type",
              "service_type"
            ) || "Fuel Service",
          deal_stage: "New (חדש)",
          probability: 10,
          owner_user_id: ownerUserId,
          assigned_team_id: assignedTeamId,
          assigned_supervisor_user_id:
            assignedSupervisorId,
          territory_id: territoryId,
          ownership_status:
            ownerUserId ?
              "assigned" :
              "unassigned",
          assigned_by_user_id:
            readString(
              lead,
              "assigned_by_user_id"
            ) || actor.id,
          assignment_date:
            readString(
              lead,
              "assignment_date"
            ) || nowIso,
          last_activity_date:
            readString(
              lead,
              "last_activity_date"
            ),
          created_date: nowIso,
          updated_date: nowIso,
          created_by_user_id: actor.id,
          last_modified_by_user_id: actor.id,
        };

        transaction.create(
          deterministicOpportunityReference,
          opportunityData
        );

        transaction.update(leadReference, {
          lead_status: "Converted",
          converted_opportunity_id:
            deterministicOpportunityReference.id,
          converted_date: nowIso,
          updated_date: nowIso,
          last_modified_by_user_id: actor.id,
        });

        const auditReference =
          entitiesReference
            .doc("AuditLog")
            .collection("records")
            .doc();

        transaction.set(auditReference, {
          action:
            "lead_converted_to_opportunity",
          actor_user_id: actor.id,
          actor_email: actor.email,
          lead_id: leadId,
          opportunity_id:
            deterministicOpportunityReference.id,
          created_date: nowIso,
          updated_date: nowIso,
        });

        return {
          opportunityId:
            deterministicOpportunityReference.id,
          created: true,
          opportunity: {
            id:
              deterministicOpportunityReference.id,
            ...opportunityData,
          },
        };
      }
    );

    return {
      success: true,
      ...result,
    };
  }
);
/**
 * Converts an authorized Closed Won opportunity into a client.
 */
export const convertOpportunityToClient = onCall(
  async (request) => {
    const actor = await requireActiveActor(
      request.auth?.uid
    );

    const payload =
      request.data &&
      typeof request.data === "object" &&
      !Array.isArray(request.data) ?
        request.data as EntityData :
        {};

    if (
      Object.keys(payload).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(
        payload,
        "opportunityId"
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Only an opportunityId may be supplied."
      );
    }

    const opportunityId = readString(
      payload,
      "opportunityId"
    );

    if (
      !opportunityId ||
      opportunityId.includes("/") ||
      opportunityId.length > 1200
    ) {
      throw new HttpsError(
        "invalid-argument",
        "A valid opportunity identifier is required."
      );
    }

    const result = await firestore.runTransaction(
      async (transaction) => {
        const entitiesReference =
          firestore.collection("entities");

        const opportunityReference =
          entitiesReference
            .doc("Opportunity")
            .collection("records")
            .doc(opportunityId);

        const opportunitySnapshot =
          await transaction.get(opportunityReference);

        if (!opportunitySnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The opportunity was not found."
          );
        }

        const opportunity =
          opportunitySnapshot.data() as EntityData;

        if (!canModifyScopedRecord(actor, opportunity)) {
          throw new HttpsError(
            "permission-denied",
            "Opportunity conversion is not authorized."
          );
        }

        const dealStage = readString(
          opportunity,
          "deal_stage",
          "dealStage"
        );

        if (
          !dealStage ||
          !dealStage.toLowerCase().includes("closed won")
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Only a Closed Won opportunity can be converted."
          );
        }

        const existingClientId = readString(
          opportunity,
          "client_id",
          "clientId"
        );

        if (existingClientId) {
          return {
            clientId: existingClientId,
            created: false,
          };
        }

        const leadId = readString(
          opportunity,
          "lead_id",
          "leadId"
        );

        if (
          !leadId ||
          leadId.includes("/") ||
          leadId.length > 1200
        ) {
          throw new HttpsError(
            "failed-precondition",
            "The opportunity does not have a valid related lead."
          );
        }

        const leadReference =
          entitiesReference
            .doc("Lead")
            .collection("records")
            .doc(leadId);

        const clientReference =
          entitiesReference
            .doc("Client")
            .collection("records")
            .doc(opportunityId);

        const taskReference =
          entitiesReference
            .doc("Task")
            .collection("records")
            .doc(opportunityId);

        const [
          leadSnapshot,
          existingClientSnapshot,
        ] = await Promise.all([
          transaction.get(leadReference),
          transaction.get(clientReference),
        ]);

        if (!leadSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "The related lead was not found."
          );
        }

        if (existingClientSnapshot.exists) {
          const existingClient =
            existingClientSnapshot.data() as EntityData;

          if (
            readString(
              existingClient,
              "crm_opportunity_id"
            ) !== opportunityId
          ) {
            throw new HttpsError(
              "already-exists",
              "The deterministic client identifier is in use."
            );
          }

          transaction.update(opportunityReference, {
            client_id: clientReference.id,
            updated_date: new Date().toISOString(),
          });

          return {
            clientId: clientReference.id,
            created: false,
          };
        }

        const lead = leadSnapshot.data() as EntityData;
        const now = new Date();
        const nowIso = now.toISOString();
        const today = nowIso.slice(0, 10);
        const renewal = new Date(now);

        renewal.setUTCFullYear(
          renewal.getUTCFullYear() + 1
        );

        const dueDate = new Date(now);

        dueDate.setUTCDate(dueDate.getUTCDate() + 7);

        const rawAmount =
          opportunity.amount ??
          opportunity.loan_amount_requested ??
          0;

        const amount =
          typeof rawAmount === "number" &&
          Number.isFinite(rawAmount) ?
            rawAmount :
            0;

        const fullName =
          readString(lead, "full_name", "fullName") ??
          readString(
            opportunity,
            "lead_name",
            "full_name"
          ) ??
          "New Client";

        const ownerUserId = readString(
          opportunity,
          "owner_user_id",
          "ownerId"
        );
        const assignedTeamId = readString(
          opportunity,
          "assigned_team_id",
          "teamId"
        );
        const assignedSupervisorId = readString(
          opportunity,
          "assigned_supervisor_user_id",
          "supervisorId"
        );
        const territoryId = readString(
          opportunity,
          "territory_id",
          "territoryId"
        );

        const clientData: EntityData = {
          crm_lead_id: leadId,
          crm_opportunity_id: opportunityId,
          full_name: fullName,
          email:
            readString(lead, "email") ??
            readString(opportunity, "email"),
          phone_number:
            readString(
              lead,
              "phone_number",
              "phone"
            ) ??
            readString(
              opportunity,
              "phone_number",
              "phone"
            ),
          product_type: readString(
            opportunity,
            "product_type"
          ),
          initial_amount: amount,
          contract_start_date: today,
          onboarding_status: "Not Started",
          customer_segment:
            amount > 50000 ?
              "Key Account" :
              amount > 10000 ?
                "Enterprise" :
                "SMB",
          health_score: 100,
          last_engagement_date: nowIso,
          renewal_date:
            renewal.toISOString().slice(0, 10),
          assigned_csm: actor.email,
          documents: mergeEntityDocuments(
            lead.documents,
            opportunity.documents
          ),
          owner_user_id: ownerUserId,
          assigned_team_id: assignedTeamId,
          assigned_supervisor_user_id:
            assignedSupervisorId,
          territory_id: territoryId,
          created_date: nowIso,
          updated_date: nowIso,
          created_by_user_id: actor.id,
          last_modified_by_user_id: actor.id,
        };

        const taskData: EntityData = {
          title: "Onboard new client: " + fullName,
          description:
            "Complete initial onboarding checklist for " +
            fullName +
            ". Source Opportunity: " +
            (
              readString(
                opportunity,
                "product_type"
              ) ?? "Unspecified"
            ),
          status: "todo",
          priority: "high",
          assigned_to: actor.email,
          related_client_id: clientReference.id,
          owner_user_id: ownerUserId,
          assigned_team_id: assignedTeamId,
          assigned_supervisor_user_id:
            assignedSupervisorId,
          territory_id: territoryId,
          due_date: dueDate.toISOString().slice(0, 10),
          created_date: nowIso,
          updated_date: nowIso,
          created_by_user_id: actor.id,
          last_modified_by_user_id: actor.id,
        };

        transaction.create(clientReference, clientData);
        transaction.create(taskReference, taskData);

        transaction.update(opportunityReference, {
          client_id: clientReference.id,
          converted_date: nowIso,
          updated_date: nowIso,
          last_modified_by_user_id: actor.id,
        });

        if (
          readString(
            lead,
            "lead_status",
            "leadStatus"
          ) !== "Converted"
        ) {
          transaction.update(leadReference, {
            lead_status: "Converted",
            converted_date: nowIso,
            updated_date: nowIso,
            last_modified_by_user_id: actor.id,
          });
        }

        const auditReference =
          entitiesReference
            .doc("AuditLog")
            .collection("records")
            .doc();

        transaction.set(auditReference, {
          action: "opportunity_converted_to_client",
          actor_user_id: actor.id,
          actor_email: actor.email,
          opportunity_id: opportunityId,
          lead_id: leadId,
          client_id: clientReference.id,
          task_id: taskReference.id,
          created_date: nowIso,
          updated_date: nowIso,
        });

        return {
          clientId: clientReference.id,
          created: true,
          client: {
            id: clientReference.id,
            ...clientData,
          },
        };
      }
    );

    return {
      success: true,
      clientId: result.clientId,
      created: result.created,
      client: result.client ?? null,
    };
  }
);
