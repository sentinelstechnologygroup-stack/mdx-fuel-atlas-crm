import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// useEffectivePermissions (Phase 3C.1)
// Fetches the current user's authoritative effective permissions from the
// `getEffectivePermissions` backend function and caches them for presentation.
//
// This is a PRESENTATION layer (Part 12): it hides/disables UI. It is NOT the
// security boundary — server-enforced authorization arrives in Phase 3C.2.
// While permissions are loading, navigation is shown (no hidden flicker).
// ---------------------------------------------------------------------------

export function useEffectivePermissions() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['effectivePermissions'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getEffectivePermissions', {});
        return res?.data || null;
      } catch (_e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 2,
    retry: false
  });

  const permissions = data?.permissions || {};

  // can_view for a module. While loading (no data), default to visible.
  const canView = (moduleKey) => {
    if (!data) return true;
    const m = permissions[moduleKey];
    return !m || m.can_view !== false;
  };

  // Generic action check: can(moduleKey, 'create' | 'edit' | ... )
  const can = (moduleKey, action) => {
    if (!data) return true;
    const m = permissions[moduleKey];
    return !m || m['can_' + action] !== false;
  };

  const recordScope = (moduleKey) => (data && permissions[moduleKey] ? permissions[moduleKey].record_scope : 'all');

  return {
    permissions,
    data,
    isLoading,
    refetch,
    invalidate: () => queryClient.invalidateQueries(['effectivePermissions']),
    canView,
    can,
    recordScope
  };
}