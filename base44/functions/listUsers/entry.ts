import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// List users for the directory / admin tools. Routes through the service role
// so MDX administrators (who may not be Base44 platform admins) can still read
// the employee directory. Applies server-side scope before returning data.
//
//   Super Admin / Administrator: the complete employee directory.
//   Supervisor: only their own record, active/inactive members of their
//     assigned team, and users whose supervisor_user_id equals their own ID.
//     Minimum information needed for team assignment and ownership display.
//   Salesperson / Viewer-Support: HTTP 403 (no directory access).
//
// Client-side filtering is never the security boundary.

function effectiveRole(u) {
  if (!u) return 'viewer_support';
  if (u.application_role) return u.application_role;
  return u.role === 'admin' ? 'super_admin' : 'viewer_support';
}

// Minimum fields a supervisor may see for team-assignment / ownership display.
const MIN_FIELDS = [
  'id', 'full_name', 'email', 'application_role', 'mdx_role_initialized',
  'account_status', 'team_id', 'supervisor_user_id', 'display_name',
  'first_name', 'last_name', 'profile_photo_url', 'role', 'access_level',
  'job_title'
];

function projectMinimal(u) {
  const out = {};
  for (const k of MIN_FIELDS) if (k in u) out[k] = u[k];
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = effectiveRole(user);
    const isAdminTier = role === 'super_admin' || role === 'administrator' || user.role === 'admin';
    const isSupervisor = role === 'supervisor';

    if (!isAdminTier && !isSupervisor) {
      return Response.json({ error: 'Forbidden: directory access is administrator or supervisor only.' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);

    if (isAdminTier) {
      // Full directory for administration.
      return Response.json({ users: allUsers });
    }

    // Supervisor scope (applied server-side before returning).
    const myTeamId = user.team_id || null;
    const scoped = allUsers.filter((u) => {
      if (u.id === user.id) return true; // own record
      if (myTeamId && u.team_id && u.team_id === myTeamId) return true; // team members
      if (u.supervisor_user_id && u.supervisor_user_id === user.id) return true; // direct reports
      return false;
    });

    return Response.json({ users: scoped.map(projectMinimal) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});