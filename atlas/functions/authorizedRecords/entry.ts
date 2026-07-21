import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// ---------------------------------------------------------------------------
// authorizedRecords — MDX server-enforced authorization gateway (Phase 3C.2)
//
// Authoritative, portable record-access boundary for protected CRM modules.
// This is the ONLY place service-role data access is granted for protected
// business records. Client-side navigation/button visibility is UX only.
//
// Resolution:
//   1. Authenticate the user (auth.me). Reject inactive/suspended accounts.
//   2. Resolve effective permission for the requested module via the
//      existing getEffectivePermissions backend function (which honours
//      protected super_admin, active custom roles, and active non-expired
//      user overrides). Override expiry / inactive custom role fallback are
//      handled there, so this gateway trusts its result.
//   3. Map the requested operation to a permission action flag (can_view…).
//   4. Enforce record scope (none / own / team / all) server-side using
//      service-role queries — never the browser-supplied filter alone.
//   5. Whitelist module keys, entity names, and readable/writable fields.
//   6. Audit denied high-risk actions and successful delete/assign/export.
//
// This file is intentionally self-contained (no local imports) because legacy platform
// functions deploy independently. The logic mirrors src/lib/permissionResolver
// .js so it travels unchanged to the independent backend.
// ---------------------------------------------------------------------------

const MODULE_MAP = {
  leads: {
    entity: 'Lead',
    owner: 'owner_user_id',
    team: 'assigned_team_id',
    supervisor: 'assigned_supervisor_user_id',
    extraOwn: null,
    legacyAssignee: 'assigned_to',
    writable: [
      'full_name', 'phone_number', 'email', 'assigned_to', 'is_deleted', 'age', 'city',
      'source_year', 'original_status_color', 'lead_status', 'last_contact_date', 'notes',
      'lead_temperature', 'tags', 'documents', 'ai_quality_score', 'ai_classification',
      'ai_analysis', 'ai_suggested_actions', 'ai_last_analysis_date', 'custom_data'
    ],
    assignable: [
      'owner_user_id', 'assigned_team_id', 'assigned_supervisor_user_id',
      'ownership_status', 'assignment_date', 'assigned_by_user_id'
    ],
    audit: ['last_modified_by_user_id', 'last_activity_date']
  },
  opportunities: {
    entity: 'Opportunity',
    owner: 'owner_user_id',
    team: 'assigned_team_id',
    supervisor: 'assigned_supervisor_user_id',
    extraOwn: null,
    legacyAssignee: null,
    writable: [
      'lead_id', 'client_id', 'lead_name', 'phone_number', 'email', 'product_type',
      'deal_type', 'amount', 'deal_stage', 'probability', 'expected_close_date',
      'next_task', 'main_pain_point', 'current_objection', 'ai_sales_strategy',
      'ai_objection_handler', 'checklist_completed', 'documents', 'custom_data'
    ],
    assignable: [
      'owner_user_id', 'assigned_team_id', 'assigned_supervisor_user_id',
      'ownership_status', 'assignment_date', 'assigned_by_user_id'
    ],
    audit: ['last_modified_by_user_id', 'last_activity_date']
  },
  tasks: {
    entity: 'Task',
    owner: 'owner_user_id',
    team: 'assigned_team_id',
    supervisor: 'assigned_supervisor_user_id',
    extraOwn: 'assignee_user_id',
    legacyAssignee: 'assigned_to',
    writable: [
      'title', 'description', 'status', 'priority', 'due_date', 'assigned_to',
      'related_lead_id', 'related_opportunity_id', 'related_client_id', 'assignee_user_id'
    ],
    assignable: [
      'owner_user_id', 'assigned_team_id', 'assigned_supervisor_user_id',
      'assigned_by_user_id', 'ownership_status'
    ],
    audit: ['last_modified_by_user_id', 'last_activity_date']
  },
  activities: {
    entity: 'Activity',
    owner: 'owner_user_id',
    team: 'assigned_team_id',
    supervisor: 'assigned_supervisor_user_id',
    extraOwn: null,
    legacyAssignee: null,
    writable: [
      'lead_id', 'opportunity_id', 'related_client_id', 'type', 'status', 'summary',
      'date', 'performed_by_user_id'
    ],
    assignable: ['owner_user_id', 'assigned_team_id', 'assigned_supervisor_user_id'],
    audit: ['last_modified_by_user_id', 'last_activity_date']
  },
  clients: {
    entity: 'Client',
    owner: 'owner_user_id',
    team: 'assigned_team_id',
    supervisor: 'assigned_supervisor_user_id',
    extraOwn: null,
    legacyAssignee: 'assigned_csm',
    writable: [
      'crm_lead_id', 'crm_opportunity_id', 'full_name', 'email', 'phone_number',
      'product_type', 'initial_amount', 'contract_start_date', 'onboarding_status',
      'onboarding_track', 'onboarding_plan', 'onboarding_items', 'customer_segment',
      'health_score', 'last_engagement_date', 'renewal_date', 'assigned_csm',
      'cs_notes', 'documents'
    ],
    assignable: [
      'owner_user_id', 'assigned_team_id', 'assigned_supervisor_user_id',
      'ownership_status', 'assignment_date', 'assigned_by_user_id'
    ],
    audit: ['last_modified_by_user_id', 'last_activity_date']
  }
};

const OP_TO_FLAG = {
  list: 'can_view',
  get: 'can_view',
  counts: 'can_view',
  create: 'can_create',
  update: 'can_edit',
  delete: 'can_delete',
  assign: 'can_assign',
  export: 'can_export'
};

const BUILTINS = ['id', 'created_date', 'updated_date', 'created_by_id'];
const HIGH_RISK = ['delete', 'assign', 'export'];

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  return u.application_role || (u.role === 'admin' ? 'super_admin' : 'viewer_support');
}
function isUserActive(u) {
  if (!u) return false;
  if (!u.account_status) return true;
  return u.account_status === 'active';
}

function readableFields(mod) {
  return new Set([...mod.writable, ...mod.assignable, ...mod.audit, ...BUILTINS]);
}

function project(record, mod) {
  if (!record) return record;
  const allow = readableFields(mod);
  const out = {};
  for (const k of Object.keys(record)) if (allow.has(k)) out[k] = record[k];
  return out;
}

function stripWritable(data, mod, allowAssign) {
  const out = {};
  const allowed = new Set(mod.writable);
  if (allowAssign) for (const f of mod.assignable) allowed.add(f);
  for (const k of Object.keys(data || {})) if (allowed.has(k)) out[k] = data[k];
  return out;
}

function changedKeys(data) { return Object.keys(data || {}); }

function isAssignOnly(data, mod) {
  const assignSet = new Set(mod.assignable);
  return changedKeys(data).every((k) => assignSet.has(k));
}

async function audit(atlasRuntime, actor, action, entity, entityId, outcome, details) {
  try {
    await atlasRuntime.asServiceRole.entities.AuditLog.create({
      action,
      entity,
      entity_id: entityId || null,
      user_email: actor?.email || 'unknown',
      details: JSON.stringify({ outcome, ...(details || {}) }),
      timestamp: new Date().toISOString()
    });
  } catch (_e) { /* audit must never break the main flow */ }
}

// Build a Mongo-style filter that enforces the effective record scope.
function buildScopeFilter(scope, user, mod, reports) {
  if (scope === 'all') return {};
  if (scope === 'none') return { _id: '__none_match__' };
  const ownerField = mod.owner;
  const orClauses = [{ [ownerField]: user.id }];
  if (mod.extraOwn) orClauses.push({ [mod.extraOwn]: user.id });
  if (mod.legacyAssignee && user.email) orClauses.push({ [mod.legacyAssignee]: user.email });
  if (scope === 'own') return { $or: orClauses };
  // team
  const teamClauses = [...orClauses];
  if (user.team_id) teamClauses.push({ [mod.team]: user.team_id });
  if (mod.supervisor) teamClauses.push({ [mod.supervisor]: user.id });
  if (reports && reports.length) teamClauses.push({ [ownerField]: { $in: reports } });
  return { $or: teamClauses };
}

// Test a fetched record against the scope (for get/update/delete).
function recordInScope(record, scope, user, mod, reports) {
  if (!record) return false;
  if (scope === 'all') return true;
  if (scope === 'none') return false;
  const ownerField = mod.owner;
  if (record[ownerField] === user.id) return true;
  if (mod.extraOwn && record[mod.extraOwn] === user.id) return true;
  if (mod.legacyAssignee && user.email && record[mod.legacyAssignee] === user.email) return true;
  if (scope === 'own') return false;
  // team
  if (user.team_id && record[mod.team] === user.team_id) return true;
  if (mod.supervisor && record[mod.supervisor] === user.id) return true;
  if (reports && reports.length && reports.includes(record[ownerField])) return true;
  return false;
}

async function getDirectReports(atlasRuntime, user) {
  if (!user || !user.id) return [];
  try {
    const reps = await atlasRuntime.asServiceRole.entities.User.filter(
      { supervisor_user_id: user.id, account_status: 'active' }, 200
    );
    return (reps || []).map((u) => u.id);
  } catch (_e) { return []; }
}

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const user = await atlasRuntime.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isUserActive(user)) {
      return Response.json({ error: 'Account is not active.' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_e) { body = {}; }
    const op = body.operation;
    const moduleKey = body.module_key;

    if (!op || !OP_TO_FLAG[op]) {
      return Response.json({ error: 'Unsupported operation.' }, { status: 400 });
    }
    const mod = MODULE_MAP[moduleKey];
    if (!mod) {
      return Response.json({ error: 'Unknown or unsupported module.' }, { status: 400 });
    }

    // 1. Resolve effective permission for this module (authoritative).
    let perm = null;
    try {
      const res = await atlasRuntime.functions.invoke('getEffectivePermissions', { module_key: moduleKey });
      perm = res?.data?.permissions?.[moduleKey] || res?.permissions?.[moduleKey] || null;
    } catch (_e) { perm = null; }
    if (!perm) {
      return Response.json({ error: 'Permission resolution failed.' }, { status: 500 });
    }

    const isSuperAdmin = perm.source === 'protected_super_admin' || effectiveRole(user) === 'super_admin';
    const flag = OP_TO_FLAG[op];
    // 'counts' and 'list'/'get' use can_view; 'assign' uses can_assign.
    const allowed = isSuperAdmin || !!perm[flag];

    // Audit denied high-risk attempts before returning.
    if (!allowed && HIGH_RISK.includes(op)) {
      await audit(atlasRuntime, user, `${op}_denied`, mod.entity, body.record_id, 'denied', {
        module_key: moduleKey, reason: `missing ${flag}`
      });
    }
    if (!allowed) {
      return Response.json({ error: 'Access denied: insufficient permission for this action.', permission: flag }, { status: 403 });
    }

    const scope = isSuperAdmin ? 'all' : perm.record_scope || 'none';
    const reports = scope === 'team' ? await getDirectReports(atlasRuntime, user) : [];
    const repo = atlasRuntime.asServiceRole.entities[mod.entity];

    // ----- READ: list / counts / export -----
    if (op === 'list' || op === 'counts' || op === 'export') {
      const scopeFilter = buildScopeFilter(scope, user, mod, reports);
      const clientFilter = body.filter && typeof body.filter === 'object' ? body.filter : null;
      let merged = scopeFilter;
      if (clientFilter && Object.keys(clientFilter).length) {
        if (Object.keys(scopeFilter).length === 0) merged = clientFilter;
        else merged = { $and: [scopeFilter, clientFilter] };
      }

      if (op === 'counts') {
        const items = await repo.filter(merged, 1000);
        return Response.json({ total: (items || []).length });
      }

      const sort = body.sort || '-updated_date';
      const limit = Math.min(Number(body.limit) || 200, 1000);
      const skip = Number(body.skip) || 0;
      let items;
      if (op === 'export') {
        // Export: pull a bounded superset, project to readable fields only.
        items = await repo.filter(merged, sort, 5000);
        await audit(atlasRuntime, user, 'export', mod.entity, null, 'success', {
          module_key: moduleKey, count: (items || []).length
        });
      } else {
        items = await repo.filter(merged, sort, limit, skip);
      }
      return Response.json({ items: (items || []).map((r) => project(r, mod)), total: (items || []).length });
    }

    // ----- READ: get -----
    if (op === 'get') {
      if (!body.record_id) return Response.json({ error: 'record_id required.' }, { status: 400 });
      const record = await repo.get(body.record_id);
      if (!record) return Response.json({ error: 'Not found.' }, { status: 404 });
      if (!recordInScope(record, scope, user, mod, reports)) {
        return Response.json({ error: 'Access denied for this record.' }, { status: 403 });
      }
      return Response.json({ record: project(record, mod) });
    }

    // ----- WRITE: create -----
    if (op === 'create') {
      const data = stripWritable(body.data || {}, mod, !!perm.can_assign || isSuperAdmin);
      // Server-set ownership defaults.
      if (data.owner_user_id === undefined) data.owner_user_id = user.id;
      if (data.assigned_team_id === undefined && user.team_id) data.assigned_team_id = user.team_id;
      if (data.assigned_supervisor_user_id === undefined && user.supervisor_user_id) {
        data.assigned_supervisor_user_id = user.supervisor_user_id;
      }
      if (data.ownership_status === undefined) {
        data.ownership_status = data.owner_user_id ? 'assigned' : 'unassigned';
      }
      if (data.assignment_date === undefined && data.owner_user_id) {
        data.assignment_date = new Date().toISOString();
      }
      if (data.assigned_by_user_id === undefined) data.assigned_by_user_id = user.id;
      data.last_modified_by_user_id = user.id;
      data.last_activity_date = new Date().toISOString();
      const created = await repo.create(data);
      return Response.json({ record: project(created, mod) });
    }

    // ----- WRITE: update / assign -----
    if (op === 'update' || op === 'assign') {
      if (!body.record_id) return Response.json({ error: 'record_id required.' }, { status: 400 });
      const record = await repo.get(body.record_id);
      if (!record) return Response.json({ error: 'Not found.' }, { status: 404 });
      if (!recordInScope(record, scope, user, mod, reports)) {
        await audit(atlasRuntime, user, 'update_denied', mod.entity, body.record_id, 'denied', {
          module_key: moduleKey, reason: 'out of scope'
        });
        return Response.json({ error: 'Access denied for this record.' }, { status: 403 });
      }
      const incoming = body.data || {};
      const assignOnly = isAssignOnly(incoming, mod);
      // Permission: full edit OR (assign-only payload + can_assign).
      const mayEdit = isSuperAdmin || !!perm.can_edit;
      const mayAssign = isSuperAdmin || !!perm.can_assign;
      if (!mayEdit && !(assignOnly && mayAssign)) {
        await audit(atlasRuntime, user, 'update_denied', mod.entity, body.record_id, 'denied', {
          module_key: moduleKey, reason: 'no edit/assign permission'
        });
        return Response.json({ error: 'Access denied: cannot edit this record.' }, { status: 403 });
      }
      const data = stripWritable(incoming, mod, mayAssign);
      if (mayAssign && (data.owner_user_id !== undefined || data.assigned_team_id !== undefined || data.assigned_supervisor_user_id !== undefined)) {
        data.assigned_by_user_id = user.id;
        data.assignment_date = new Date().toISOString();
        if (data.ownership_status === undefined) data.ownership_status = 'assigned';
        await audit(atlasRuntime, user, 'assign', mod.entity, body.record_id, 'success', {
          module_key: moduleKey, to_owner: data.owner_user_id, to_team: data.assigned_team_id
        });
      }
      data.last_modified_by_user_id = user.id;
      data.last_activity_date = new Date().toISOString();
      const updated = await repo.update(body.record_id, data);
      return Response.json({ record: project(updated, mod) });
    }

    // ----- WRITE: delete -----
    if (op === 'delete') {
      if (!body.record_id) return Response.json({ error: 'record_id required.' }, { status: 400 });
      const record = await repo.get(body.record_id);
      if (!record) return Response.json({ error: 'Not found.' }, { status: 404 });
      if (!recordInScope(record, scope, user, mod, reports)) {
        await audit(atlasRuntime, user, 'delete_denied', mod.entity, body.record_id, 'denied', {
          module_key: moduleKey, reason: 'out of scope'
        });
        return Response.json({ error: 'Access denied for this record.' }, { status: 403 });
      }
      await repo.delete(body.record_id);
      await audit(atlasRuntime, user, 'delete', mod.entity, body.record_id, 'success', { module_key: moduleKey });
      return Response.json({ deleted: true, id: body.record_id });
    }

    return Response.json({ error: 'Operation not implemented.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});