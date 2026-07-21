import { createReferenceClientFromRequest as createClientFromRequest } from '../../runtime/referenceClient';

// Centralized account-action handler. Performs role / team / supervisor /
// territory / suspend / reactivate changes for a user, enforcing:
//   - role-safety (final active Super Administrator cannot be demoted,
//     suspended, or deactivated; administrators cannot touch admin-tier users)
//   - audit logging (one AuditLog entry per action, including attempted
//     final-super-admin removal)
// All writes use the service role so MDX administrators who are not legacy platform
// platform admins can still manage non-admin users, and so audit entries
// (create: false for ordinary users) can be persisted.

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}
function isActive(u) { return !u || !u.account_status || u.account_status === 'active'; }

Deno.serve(async (req) => {
  try {
    const atlasRuntime = createClientFromRequest(req);
    const user = await atlasRuntime.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const actorRole = effectiveRole(user);
    const isAdminTier = actorRole === 'super_admin' || actorRole === 'administrator' || user.role === 'admin';
    if (!isAdminTier) {
      return Response.json({ error: 'Forbidden: account management is administrator-only.' }, { status: 403 });
    }

    const body = await req.json();
    const action = body.action; // role | team | supervisor | territory | suspend | reactivate
    const targetId = body.target_user_id;
    const value = body.value;
    const reason = (body.reason || '').trim();
    if (!targetId || !action) return Response.json({ error: 'Missing action or target_user_id' }, { status: 400 });

    const target = await atlasRuntime.asServiceRole.entities.User.get(targetId);
    if (!target) return Response.json({ error: 'Target user not found' }, { status: 404 });

    const targetRole = effectiveRole(target);
    // Administrators cannot manage super_admin or administrator users.
    if (actorRole === 'administrator' && (targetRole === 'super_admin' || targetRole === 'administrator')) {
      return Response.json({ error: 'Administrators may not manage Super Administrators or other Administrators.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const update = { last_modified_by_user_id: user.id, profile_modified_date: now };
    let auditAction = 'user_update';
    let auditDetails = { action };

    // Load all users to evaluate final-super-admin protection with effective role.
    const allUsers = await atlasRuntime.asServiceRole.entities.User.list('-created_date', 500);
    const activeSuperAdmins = allUsers.filter((u) => isActive(u) && effectiveRole(u) === 'super_admin');
    const isLastSuperAdmin = targetRole === 'super_admin' && isActive(target) && activeSuperAdmins.length <= 1 &&
      activeSuperAdmins.some((u) => u.id === target.id);

    if (action === 'role') {
      const newRole = value;
      if (!['super_admin', 'administrator', 'supervisor', 'salesperson', 'viewer_support'].includes(newRole)) {
        return Response.json({ error: 'Invalid role' }, { status: 400 });
      }
      // Administrators cannot grant admin-tier roles.
      if (actorRole === 'administrator' && (newRole === 'super_admin' || newRole === 'administrator')) {
        return Response.json({ error: 'Only a Super Administrator may assign Administrator or Super Administrator roles.' }, { status: 403 });
      }
      // Final super admin cannot be demoted.
      if (isLastSuperAdmin && newRole !== 'super_admin') {
        try {
          await atlasRuntime.asServiceRole.entities.AuditLog.create({
            action: 'attempted_final_super_admin_removal',
            entity: 'User', entity_id: target.id, user_email: user.email,
            details: JSON.stringify({ attempted_role: newRole }), timestamp: now
          });
        } catch (_e) {}
        return Response.json({ error: 'The final active Super Administrator cannot be removed from the Super Administrator role.' }, { status: 400 });
      }
      update.application_role = newRole;
      // An intentionally assigned MDX role is marked initialized so it is never
      // overwritten by a later bootstrap, and so the schema default is not
      // mistaken for an intentional Viewer/Support assignment.
      update.mdx_role_initialized = true;
      if (newRole === 'super_admin' && !target.activated_date) update.activated_date = now;
      auditAction = 'role_assign';
      auditDetails = { from: targetRole, to: newRole };
    } else if (action === 'team') {
      update.team_id = value || null;
      auditAction = 'team_change';
      auditDetails = { from: target.team_id, to: value };
    } else if (action === 'supervisor') {
      update.supervisor_user_id = value || null;
      auditAction = 'supervisor_change';
      auditDetails = { from: target.supervisor_user_id, to: value };
    } else if (action === 'territory') {
      update.territory_ids = Array.isArray(value) ? value : [];
      auditAction = 'territory_change';
      auditDetails = { territory_ids: update.territory_ids };
    } else if (action === 'suspend') {
      if (isLastSuperAdmin) {
        return Response.json({ error: 'The final active Super Administrator cannot be suspended.' }, { status: 400 });
      }
      update.account_status = 'suspended';
      update.deactivated_date = now;
      update.deactivated_by_user_id = user.id;
      update.deactivation_reason = reason || 'Suspended by administrator';
      auditAction = 'user_suspend';
      auditDetails = { reason: update.deactivation_reason };
    } else if (action === 'reactivate') {
      update.account_status = 'active';
      update.deactivated_date = null;
      update.deactivated_by_user_id = null;
      update.deactivation_reason = null;
      update.activated_date = target.activated_date || now;
      auditAction = 'user_reactivation';
      auditDetails = {};
    } else {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    await atlasRuntime.asServiceRole.entities.User.update(target.id, update);

    try {
      await atlasRuntime.asServiceRole.entities.AuditLog.create({
        action: auditAction,
        entity: 'User',
        entity_id: target.id,
        user_email: user.email,
        details: JSON.stringify(auditDetails),
        timestamp: now
      });
    } catch (_e) { /* best-effort */ }

    return Response.json({ success: true, action: auditAction });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});