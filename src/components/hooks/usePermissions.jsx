import { useAuth } from '@/auth/AuthContext';
import {
  effectiveRole,
  isEffectiveAdminTier,
  isEffectiveSalesperson,
  isEffectiveSuperAdmin,
  isEffectiveSupervisor,
  isEffectiveViewerSupport,
} from '@/lib/roles';

export function usePermissions() {
  const {
    profile: user,
    isLoadingAuth,
  } = useAuth();

  const applicationRole = effectiveRole(user);
  const isSuperAdmin = isEffectiveSuperAdmin(user);
  const isAdministrator = applicationRole === 'administrator';
  const isSupervisor = isEffectiveSupervisor(user);
  const isSalesperson = isEffectiveSalesperson(user);
  const isViewerSupport = isEffectiveViewerSupport(user);
  const isAdminTier = isEffectiveAdminTier(user);
  const isEditor = isAdminTier || isSupervisor || isSalesperson;

  return {
    user,
    isLoading: isLoadingAuth,
    applicationRole,
    rawApplicationRole: user?.application_role ?? null,
    isSuperAdmin,
    isAdministrator,
    isSupervisor,
    isSalesperson,
    isViewerSupport,
    isAdminTier,
    canManageAdministrators: isSuperAdmin,
    canManageUsers: isAdminTier,
    canManageTeams: isAdminTier,
    canManageTerritories: isAdminTier,
    isAdmin: isAdminTier,
    isEditor,
    isViewer: !isEditor,
    canEdit: isEditor,
    canCreate: isEditor,
    canDelete: isAdminTier,
  };
}