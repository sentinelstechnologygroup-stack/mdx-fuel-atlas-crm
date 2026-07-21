import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// ---------------------------------------------------------------------------
// updateRoleDefinition (Phase 3C.1, Part 10)
// Activate / deactivate / delete a custom role. Server-enforced authority.
// Deactivation identifies affected users; deletion is blocked while active
// users are assigned. System roles cannot be deleted or deactivated.
// ---------------------------------------------------------------------------

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

async function writeAudit(atlasRuntime, actor, details) {
  try {
    await atlasRuntime.asServiceRole.entities.AuditLog.create({
      action: 'custom_role_' + (details.event || 'update'),
      entity: 'RoleDefinition',
      entity_id: details.entity_id || null,
      user_email: actor?.email || 'system',
      details: JSON.stringify(details),
      timestamp: new Date().toISOString()
    });
  } catch (_e) { /* non-blocking */ }
}

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const user = await atlasRuntime.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorRole = effectiveRole(user);
    if (actorRole !== 'super_admin' && actorRole !== 'administrator' && user.role !== 'admin') {
      return Response.json({ error: 'Only administrators may manage custom roles.' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch (_e) { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }
    const { role_definition_id, action, reason } = body;
    if (!role_definition_id || !action) return Response.json({ error: 'role_definition_id and action are required.' }, { status: 400 });
    if (!['activate', 'deactivate', 'delete'].includes(action)) return Response.json({ error: 'Invalid action.' }, { status: 400 });

    const roleDef = await atlasRuntime.asServiceRole.entities.RoleDefinition.get(role_definition_id);
    if (!roleDef) return Response.json({ error: 'Role definition not found.' }, { status: 404 });
    if (roleDef.role_type !== 'custom') {
      await writeAudit(atlasRuntime, user, { event: 'denied_system_role_modify', role_key: roleDef.role_key, action });
      return Response.json({ error: 'System roles cannot be modified here.' }, { status: 403 });
    }

    // Administrator-inheriting custom roles may only be managed by Super Administrator.
    if (actorRole !== 'super_admin' && (roleDef.base_role_key === 'super_admin' || roleDef.base_role_key === 'administrator')) {
      await writeAudit(atlasRuntime, user, { event: 'denied_admin_custom_role', role_key: roleDef.role_key, action });
      return Response.json({ error: 'Only a Super Administrator may manage custom roles inheriting from Administrator.' }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Find affected users (assigned to this custom role).
    let affectedUsers = [];
    try {
      const users = await atlasRuntime.asServiceRole.entities.User.list(500);
      affectedUsers = (users || []).filter((u) => u.custom_role_id === roleDef.id);
    } catch (_e) { /* ignore */ }
    const activeAffected = affectedUsers.filter((u) => !u.account_status || u.account_status === 'active');

    if (action === 'delete') {
      if (activeAffected.length > 0) {
        await writeAudit(atlasRuntime, user, { event: 'denied_delete_assigned', role_key: roleDef.role_key, active_users: activeAffected.length });
        return Response.json({ error: 'A role assigned to active users cannot be deleted. Deactivate it instead.', affected_users: activeAffected.map((u) => u.email) }, { status: 400 });
      }
      await atlasRuntime.asServiceRole.entities.RoleDefinition.delete(roleDef.id);
      await writeAudit(atlasRuntime, user, { event: 'delete', role_key: roleDef.role_key, reason: reason || null, entity_id: roleDef.id });
      return Response.json({ status: 'deleted' });
    }

    const newStatus = action === 'activate' ? 'active' : 'inactive';
    const updated = await atlasRuntime.asServiceRole.entities.RoleDefinition.update(roleDef.id, {
      status: newStatus,
      last_modified_by_user_id: user.id,
      modified_date: now
    });

    await writeAudit(atlasRuntime, user, {
      event: action, role_key: roleDef.role_key, new_status: newStatus,
      reason: reason || null, affected_users: affectedUsers.map((u) => u.email),
      entity_id: roleDef.id
    });

    return Response.json({
      status: 'updated',
      role: updated,
      affected_users: affectedUsers.map((u) => ({ id: u.id, email: u.email, account_status: u.account_status || 'active' })),
      fallback_note: newStatus === 'inactive' ? 'Users assigned this inactive role fall back to their base application_role.' : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});