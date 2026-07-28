import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listManagedUsers,
  updateManagedUserRole,
} from '@/api/userDirectoryService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { APPLICATION_ROLES, ASSIGNABLE_ROLES_BY_ADMIN, roleLabel, displayName } from '@/lib/roles';
import UserAvatar from '@/components/settings/UserAvatar';

export default function RoleAssignment() {
  const { theme } = useSettings();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users_role_assignment'],
    queryFn: listManagedUsers,
    initialData: []
  });

  const activeSuperAdmins = useMemo(
    () => users.filter((u) => u.application_role === 'super_admin' && u.account_status === 'active'),
    [users]
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      updateManagedUserRole(
        id,
        data.application_role
      ),
    onSuccess: () => {
      queryClient.invalidateQueries(['users_role_assignment']);
      queryClient.invalidateQueries(['users_directory']);
      queryClient.invalidateQueries(['users_management']);
    }
  });

  const targetIsAdminTier = (u) => u.application_role === 'super_admin' || u.application_role === 'administrator';
  const canManage = (u) => {
    if (!perms.canManageUsers) return false;
    if (perms.isSuperAdmin) return true;
    if (targetIsAdminTier(u)) return false;
    return true;
  };

  const assignable = (u) => {
    if (perms.isSuperAdmin) return APPLICATION_ROLES;
    if (!canManage(u)) return [];
    return APPLICATION_ROLES.filter((r) => ASSIGNABLE_ROLES_BY_ADMIN.includes(r.value));
  };

  const handleChange = (u, newRole) => {
    const isLastSuperAdmin = u.application_role === 'super_admin' && activeSuperAdmins.length <= 1;
    if (u.application_role === 'super_admin' && newRole !== 'super_admin' && isLastSuperAdmin) {
      alert('The final active Super Administrator cannot be removed from the Super Administrator role.');
      return;
    }
    if (!perms.isSuperAdmin && (newRole === 'super_admin' || newRole === 'administrator')) {
      alert('Only a Super Administrator may assign Administrator or Super Administrator roles.');
      return;
    }
    updateMutation.mutate(
      { id: u.id, data: { application_role: newRole, last_modified_by_user_id: perms.user?.id, profile_modified_date: new Date().toISOString() } },
      { onError: (e) => alert('Failed to update role: ' + e.message) }
    );
  };

  const filtered = users.filter((u) => {
    if (search) {
      const n = displayName(u).toLowerCase();
      if (!n.includes(search.toLowerCase()) && !(u.email || '').toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const selectClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Role Assignment</h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          Assign the MDX application role for each employee. Administrator and Super Administrator changes require a Super Administrator.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-9 ${selectClass}`} />
      </div>

      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Table>
          <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
            <TableRow>
              <TableHead className="text-left">Employee</TableHead>
              <TableHead className="text-left">Current Role</TableHead>
              <TableHead className="text-left">Assign Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={3} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No users found.</TableCell></TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id} className={theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={u} size="sm" />
                    <div className="min-w-0">
                      <p className={`font-medium truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{displayName(u)}</p>
                      <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{roleLabel(u.application_role)}</TableCell>
                <TableCell>
                  {canManage(u) ? (
                    <Select value={u.application_role || 'viewer_support'} onValueChange={(v) => handleChange(u, v)}>
                      <SelectTrigger className={`w-56 ${selectClass}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {assignable(u).map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No permission to change</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
