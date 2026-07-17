import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Idempotent bootstrap of the first MDX Super Administrator.
//
// Rules (Phase 3B.1):
//   1. Only the Base44 project-owner administrator (role === 'admin') is a
//      bootstrap candidate. Ordinary Base44 users are never promoted.
//   2. If an MDX role has already been intentionally assigned
//      (mdx_role_initialized === true), never overwrite it.
//   3. If the calling admin is already an explicit active super_admin (but not
//      yet marked initialized), complete the initialization marker only.
//   4. If any OTHER active explicit super_admin already exists, do not
//      bootstrap another. We never promote every Base44 administrator.
//   5. If no active explicit super_admin exists, initialize the calling admin
//      as the first MDX Super Administrator and persist mdx_role_initialized.
//   6. This works even if Base44 applied the schema default
//      application_role: "viewer_support" before the bootstrap ran, because
//      mdx_role_initialized distinguishes an intentional assignment from the
//      schema default.
//   7. Final active Super Administrator protections remain enforced in
//      updateUserAccount and deactivateUserWithTransfer.

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}
function isActive(u) { return !u || !u.account_status || u.account_status === 'active'; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only the Base44 project-owner admin is a bootstrap candidate.
    if (user.role !== 'admin') {
      return Response.json({
        bootstrapped: false,
        reason: 'not_bootstrap_admin',
        application_role: user.application_role || null
      });
    }

    // An intentionally assigned MDX role is never overwritten automatically.
    if (user.mdx_role_initialized === true) {
      return Response.json({
        bootstrapped: false,
        reason: 'role_already_initialized',
        application_role: user.application_role
      });
    }

    // The calling admin is already an explicit active super_admin but the
    // initialization marker was never set — complete it idempotently.
    if (user.application_role === 'super_admin') {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.User.update(user.id, {
        mdx_role_initialized: true,
        account_status: 'active',
        activated_date: user.activated_date || now,
        profile_modified_date: now
      });
      return Response.json({
        bootstrapped: true,
        reason: 'completed_self_super_admin',
        application_role: 'super_admin',
        account_status: 'active'
      });
    }

    // Check whether any active explicit super_admin already exists.
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const otherActiveSuperAdmin = allUsers.some(
      (u) => u.id !== user.id && u.application_role === 'super_admin' && isActive(u)
    );
    if (otherActiveSuperAdmin) {
      return Response.json({
        bootstrapped: false,
        reason: 'super_admin_exists',
        application_role: user.application_role || null
      });
    }

    // No active explicit super_admin exists — initialize the first one.
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.User.update(user.id, {
      application_role: 'super_admin',
      mdx_role_initialized: true,
      account_status: 'active',
      activated_date: user.activated_date || now,
      profile_modified_date: now
    });

    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'bootstrap_super_admin',
        entity: 'User',
        entity_id: user.id,
        user_email: user.email,
        details: 'Bootstrap: initialized first MDX Super Administrator and persisted mdx_role_initialized.',
        timestamp: now
      });
    } catch (_e) { /* audit is best-effort */ }

    return Response.json({
      bootstrapped: true,
      reason: 'first_super_admin_initialized',
      application_role: 'super_admin',
      account_status: 'active'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});