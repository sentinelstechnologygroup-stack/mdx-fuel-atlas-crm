import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { MoreVertical, Search, Eye, Pencil, ShieldCheck, Users, MapPin, UserCheck, UserX, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useDirectoryData } from '@/components/hooks/useDirectoryData';
import { APPLICATION_ROLES, ASSIGNABLE_ROLES_BY_ADMIN, roleLabel, statusLabel, displayName, effectiveRole, canDeactivateUser } from '@/lib/roles';
import UserAvatar from '@/components/settings/UserAvatar';
import UserProfileView from '@/components/settings/UserProfileView';
import UserProfileEditor from '@/components/settings/UserProfileEditor';
import DeactivateUserDialog from '@/components/ownership/DeactivateUserDialog';
import { useToast } from '@/components/ui/use-toast';

const STATUS_BADGE = {
  active: 'bg-emerald-100 text-emerald-700',
  invited: 'bg-blue-100 text-blue-700',
  inactive: 'bg-slate-200 text-slate-600',
  suspended: 'bg-red-100 text-red-700'
};

export default function UserDirectory() {
  const { theme } = useSettings();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { users, teams } = useDirectoryData();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [supervisorFilter, setSupervisorFilter] = useState('all');
  const [territoryFilter, setTerritoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [action, setAction] = useState(null); // { type, user }
  const [formValue, setFormValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const { data: territories = [] } = useQuery({
    queryKey: ['territories_directory'],
    queryFn: () => atlas.entities.Territory.list(),
    initialData: []
  });

  const refreshAll = () => {
    queryClient.invalidateQueries(['directoryUsers']);
    queryClient.invalidateQueries(['directoryTeams']);
    queryClient.invalidateQueries(['users_management']);
  };

  const resolveTeam = (id) => teams.find((t) => t.id === id);
  const resolveUser = (id) => users.find((u) => u.id === id);
  const resolveTerritories = (ids = []) => territories.filter((t) => (ids || []).includes(t.id));

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const name = displayName(u).toLowerCase();
      const email = (u.email || '').toLowerCase();
      if (search && !name.includes(search.toLowerCase()) && !email.includes(search.toLowerCase())) return false;
      if (roleFilter !== 'all' && effectiveRole(u) !== roleFilter) return false;
      if (teamFilter !== 'all' && u.team_id !== teamFilter) return false;
      if (supervisorFilter !== 'all' && u.supervisor_user_id !== supervisorFilter) return false;
      if (territoryFilter !== 'all' && !(u.territory_ids || []).includes(territoryFilter)) return false;
      if (statusFilter !== 'all' && (u.account_status || 'active') !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, teamFilter, supervisorFilter, territoryFilter, statusFilter]);

  // Authority (client-side mirror of server rules; server re-validates).
  const canManageUser = (u) => {
    if (!perms.canManageUsers) return false;
    if (perms.isSuperAdmin) return true;
    const r = effectiveRole(u);
    return r !== 'super_admin' && r !== 'administrator';
  };

  const assignableRoles = (u) => {
    if (perms.isSuperAdmin) return APPLICATION_ROLES;
    if (!canManageUser(u)) return [];
    return APPLICATION_ROLES.filter((r) => ASSIGNABLE_ROLES_BY_ADMIN.includes(r.value));
  };

  const openAction = (type, user) => {
    setAction({ type, user });
    if (type === 'role') setFormValue(effectiveRole(user));
    else if (type === 'team') setFormValue(user.team_id || 'none');
    else if (type === 'supervisor') setFormValue(user.supervisor_user_id || 'none');
    else if (type === 'territory') setFormValue((user.territory_ids || []).join(','));
    else setFormValue('');
    setReason('');
  };

  const closeAction = () => { setAction(null); setFormValue(''); setReason(''); };

  // Centralized account action via backend (enforces protection + audit).
  const runAccountAction = async (payload) => {
    setSaving(true);
    try {
      const res = await atlas.functions.invoke('updateUserAccount', payload);
      if (res?.data?.error) throw new Error(res.data.error);
      toast({ title: 'Action completed' });
      refreshAll();
      closeAction();
    } catch (e) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!action) return;
    const { type, user } = action;
    if (type === 'role') return runAccountAction({ action: 'role', target_user_id: user.id, value: formValue });
    if (type === 'team') return runAccountAction({ action: 'team', target_user_id: user.id, value: formValue === 'none' ? null : formValue });
    if (type === 'supervisor') return runAccountAction({ action: 'supervisor', target_user_id: user.id, value: formValue === 'none' ? null : formValue });
    if (type === 'territory') return runAccountAction({ action: 'territory', target_user_id: user.id, value: formValue.split(',').filter(Boolean) });
    if (type === 'suspend') return runAccountAction({ action: 'suspend', target_user_id: user.id, reason });
    if (type === 'reactivate') return runAccountAction({ action: 'reactivate', target_user_id: user.id });
  };

  const selectClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

  if (perms.isLoading || !users.length && perms.isAdminTier === undefined) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
          <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-9 ${selectClass}`} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {APPLICATION_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Team" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Supervisor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Supervisors</SelectItem>
            {users.filter((u) => ['supervisor', 'administrator', 'super_admin'].includes(effectiveRole(u))).map((u) => (
              <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Territory" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Territories</SelectItem>
            {territories.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={selectClass}><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Table>
          <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
            <TableRow>
              <TableHead className="text-left">Employee</TableHead>
              <TableHead className="text-left hidden md:table-cell">Role</TableHead>
              <TableHead className="text-left hidden lg:table-cell">Team</TableHead>
              <TableHead className="text-left hidden xl:table-cell">Supervisor</TableHead>
              <TableHead className="text-left hidden xl:table-cell">Territories</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-left hidden lg:table-cell">Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className={`text-center py-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No users found.</TableCell></TableRow>
            )}
            {filtered.map((u) => {
              const team = resolveTeam(u.team_id);
              const supervisor = resolveUser(u.supervisor_user_id);
              const userTerritories = resolveTerritories(u.territory_ids);
              const status = u.account_status || 'active';
              const can = canDeactivateUser(perms.user, u, users);
              return (
                <TableRow key={u.id} className={theme === 'dark' ? 'border-slate-700 hover:bg-slate-700/40' : 'border-slate-100 hover:bg-slate-50'}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar user={u} size="sm" />
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{displayName(u)}</p>
                        <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{u.email}</p>
                        {u.job_title && <p className={`text-[11px] truncate ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{u.job_title}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={theme === 'dark' ? 'border-slate-600 text-slate-300' : 'text-slate-600'}>{roleLabel(effectiveRole(u))}</Badge>
                  </TableCell>
                  <TableCell className={`hidden lg:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{team?.name || '—'}</TableCell>
                  <TableCell className={`hidden xl:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{supervisor ? displayName(supervisor) : '—'}</TableCell>
                  <TableCell className={`hidden xl:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {userTerritories.length ? `${userTerritories.length} (${userTerritories[0].name}${userTerritories.length > 1 ? '…' : ''})` : '—'}
                  </TableCell>
                  <TableCell><Badge className={STATUS_BADGE[status]}>{statusLabel(status)}</Badge></TableCell>
                  <TableCell className={`hidden lg:table-cell text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {u.last_login_date ? new Date(u.last_login_date).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openAction('view', u)}><Eye className="w-4 h-4 mr-2" /> View Profile</DropdownMenuItem>
                        {canManageUser(u) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openAction('profile', u)}><Pencil className="w-4 h-4 mr-2" /> Edit Protected Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAction('role', u)}><ShieldCheck className="w-4 h-4 mr-2" /> Assign Role</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAction('team', u)}><Users className="w-4 h-4 mr-2" /> Assign Team</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAction('supervisor', u)}><UserCheck className="w-4 h-4 mr-2" /> Assign Supervisor</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAction('territory', u)}><MapPin className="w-4 h-4 mr-2" /> Assign Territory</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {status !== 'active' && status !== 'invited' && (
                              <DropdownMenuItem onClick={() => openAction('reactivate', u)} className="text-emerald-600"><RotateCcw className="w-4 h-4 mr-2" /> Reactivate</DropdownMenuItem>
                            )}
                            {status === 'active' && (
                              <DropdownMenuItem onClick={() => setDeactivateTarget(u)} className="text-amber-600" disabled={!can}><UserX className="w-4 h-4 mr-2" /> Deactivate</DropdownMenuItem>
                            )}
                            {status !== 'suspended' && (
                              <DropdownMenuItem onClick={() => openAction('suspend', u)} className="text-red-600"><Pause className="w-4 h-4 mr-2" /> Suspend</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Action / Profile Dialog */}
      <Dialog open={!!action} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="max-w-lg">
          {action?.type === 'view' && (
            <>
              <DialogHeader><DialogTitle>Employee Profile</DialogTitle></DialogHeader>
              <UserProfileView user={action.user} team={resolveTeam(action.user.team_id)} supervisor={resolveUser(action.user.supervisor_user_id)} territories={resolveTerritories(action.user.territory_ids)} />
              <DialogFooter><Button variant="ghost" onClick={closeAction}>Close</Button></DialogFooter>
            </>
          )}

          {action?.type === 'profile' && (
            <>
              <DialogHeader><DialogTitle>Edit Employee Profile — {displayName(action.user)}</DialogTitle></DialogHeader>
              <UserProfileEditor
                user={action.user}
                onCancel={closeAction}
                onSaved={() => {
                  refreshAll();
                  closeAction();
                }}
              />
            </>
          )}

          {action?.type === 'role' && (
            <>
              <DialogHeader>
                <DialogTitle>Assign Role — {displayName(action.user)}</DialogTitle>
                <DialogDescription>Changing Administrator or Super Administrator status is recorded in the audit trail. The final active Super Administrator cannot be removed.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label>MDX Application Role</Label>
                <Select value={formValue} onValueChange={setFormValue}>
                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                  <SelectContent>{assignableRoles(action.user).map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeAction}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} className="bg-slate-900 text-white">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}</Button>
              </DialogFooter>
            </>
          )}

          {(action?.type === 'team' || action?.type === 'supervisor') && (
            <>
              <DialogHeader><DialogTitle>{action.type === 'team' ? 'Assign Team' : 'Assign Supervisor'} — {displayName(action.user)}</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Label>{action.type === 'team' ? 'Team' : 'Supervisor'}</Label>
                <Select value={formValue} onValueChange={setFormValue}>
                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {action.type === 'team'
                      ? teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)
                      : users.filter((u) => ['supervisor', 'administrator', 'super_admin'].includes(effectiveRole(u))).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeAction}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} className="bg-slate-900 text-white">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
              </DialogFooter>
            </>
          )}

          {action?.type === 'territory' && (
            <>
              <DialogHeader><DialogTitle>Assign Territories — {displayName(action.user)}</DialogTitle><DialogDescription>Select all territories this employee covers.</DialogDescription></DialogHeader>
              <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
                {territories.length === 0 && <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>No territories defined yet.</p>}
                {territories.map((t) => {
                  const checked = formValue.split(',').includes(t.id);
                  return (
                    <label key={t.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        const ids = new Set(formValue.split(',').filter(Boolean));
                        if (e.target.checked) ids.add(t.id); else ids.delete(t.id);
                        setFormValue(Array.from(ids).join(','));
                      }} />
                      <span className={theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}>{t.name}</span>
                    </label>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeAction}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} className="bg-slate-900 text-white">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
              </DialogFooter>
            </>
          )}

          {action?.type === 'suspend' && (
            <>
              <DialogHeader><DialogTitle>Suspend — {displayName(action.user)}</DialogTitle><DialogDescription>The account is preserved with full history. The final active Super Administrator cannot be suspended.</DialogDescription></DialogHeader>
              <div className="space-y-3 py-2">
                <Label>Reason (optional)</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for suspension" className={selectClass} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeAction}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} variant="destructive">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suspend'}</Button>
              </DialogFooter>
            </>
          )}

          {action?.type === 'reactivate' && (
            <>
              <DialogHeader><DialogTitle>Reactivate — {displayName(action.user)}</DialogTitle><DialogDescription>The account status will be set back to Active.</DialogDescription></DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={closeAction}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 text-white">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reactivate'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced deactivation dialog */}
      <DeactivateUserDialog user={deactivateTarget} open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)} onDone={refreshAll} />
    </div>
  );
}
