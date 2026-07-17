import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  effectiveRole as computeEffectiveRole,
  isEffectiveAdminTier,
  isEffectiveSuperAdmin,
  isEffectiveSupervisor,
  isEffectiveSalesperson,
  isEffectiveViewerSupport
} from '@/lib/roles';

// ---------------------------------------------------------------------------
// MDX application-role permission layer (Phase 3A / 3B)
//
// Portable MDX `application_role` hierarchy:
//   super_admin > administrator > supervisor > salesperson > viewer_support
//
// TEMPORARY BASE44 COMPATIBILITY (remove during independent migration):
//   The Base44 `role` (admin/user) and legacy `access_level` (viewer/editor)
//   are preserved so existing components keep working.
//
//   Bootstrap (Phase 3B corrected): the first time an authenticated Base44
//   project-owner administrator opens the app with no explicit
//   `application_role`, `bootstrapSuperAdmin` PERSISTS super_admin + active
//   status once (idempotent). After that, the role is read from the record;
//   the Base44 fallback is only secondary and never overwrites an explicit
//   role.
// ---------------------------------------------------------------------------

export function usePermissions() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUserPermissions'],
    queryFn: () => base44.auth.me(),
    staleTime: 1000 * 60 * 5,
    retry: false
  });

  // Idempotent bootstrap — runs once per session, persists the super_admin
  // role for a Base44 admin with no explicit role, then invalidates the
  // cached user so the persisted role is used everywhere.
  useQuery({
    queryKey: ['bootstrapSuperAdmin'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('bootstrapSuperAdmin', {});
        if (res?.data?.bootstrapped) {
          queryClient.invalidateQueries(['currentUserPermissions']);
        }
        return res?.data;
      } catch (_e) {
        return null;
      }
    },
    enabled: !isLoading && !!user,
    staleTime: Infinity,
    retry: false
  });

  const base44Role = user?.role;
  const rawAppRole = user?.application_role;
  const isBootstrapAdmin = base44Role === 'admin';

  // Effective role prefers the persisted MDX role; the Base44 fallback is
  // secondary and only applies when no explicit role exists.
  const applicationRole = computeEffectiveRole(user);

  const isSuperAdmin = isEffectiveSuperAdmin(user);
  const isAdministrator = applicationRole === 'administrator';
  const isSupervisor = isEffectiveSupervisor(user);
  const isSalesperson = isEffectiveSalesperson(user);
  const isViewerSupport = isEffectiveViewerSupport(user);
  const isAdminTier = isEffectiveAdminTier(user);

  // Management helpers.
  const canManageAdministrators = isSuperAdmin;
  const canManageUsers = isAdminTier;
  const canManageTeams = isAdminTier;
  const canManageTerritories = isAdminTier;

  // Legacy backward-compatible flags (preserve existing component behavior).
  const isAdmin = isSuperAdmin || isAdministrator || isBootstrapAdmin;
  const isEditor = isAdmin || user?.access_level === 'editor';
  const isViewer = !isEditor;

  return {
    user,
    isLoading,
    applicationRole,
    rawApplicationRole: rawAppRole,
    isBootstrapAdmin,
    isSuperAdmin,
    isAdministrator,
    isSupervisor,
    isSalesperson,
    isViewerSupport,
    isAdminTier,
    canManageAdministrators,
    canManageUsers,
    canManageTeams,
    canManageTerritories,
    isAdmin,
    isEditor,
    isViewer,
    canEdit: isEditor,
    canCreate: isEditor,
    canDelete: isEditor
  };
}