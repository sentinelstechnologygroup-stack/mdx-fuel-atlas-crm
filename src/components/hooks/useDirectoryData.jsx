import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePermissions } from '@/components/hooks/usePermissions';

// Fetches the employee directory (via the admin/supervisor backend function
// so MDX administrators who are not Base44 platform admins can still read it)
// and the team list. Returns maps for quick owner/team lookups.

export function useDirectoryData() {
  const { isAdminTier, isSupervisor } = usePermissions();

  const usersQuery = useQuery({
    queryKey: ['directoryUsers'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listUsers', {});
      return res?.data?.users || [];
    },
    enabled: isAdminTier || isSupervisor,
    staleTime: 1000 * 60 * 2
  });

  const teamsQuery = useQuery({
    queryKey: ['directoryTeams'],
    queryFn: async () => base44.entities.Team.list('-created_date', 200),
    enabled: isAdminTier || isSupervisor,
    staleTime: 1000 * 60 * 2
  });

  const users = usersQuery.data || [];
  const teams = teamsQuery.data || [];

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  return {
    users,
    teams,
    userById,
    teamById,
    isLoading: usersQuery.isLoading || teamsQuery.isLoading,
    refetch: async () => {
      await Promise.all([usersQuery.refetch(), teamsQuery.refetch()]);
    }
  };
}