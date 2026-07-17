import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Ban, ShieldOff, UserCog } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { displayName, roleLabel } from '@/lib/roles';
import { ACTIVE_MODULES, MODULE_BY_KEY, ACTION_FLAGS, RECORD_SCOPES } from '@/lib/permissionModules';
import UserAvatar from '@/components/settings/UserAvatar';

const SCOPE_LABELS = { none: 'None', own: 'Own', team: 'Team', all: 'All' };
const MODE_LABELS = { inherit: 'Inherit (use role permission)', replace: 'Replace (substitute values)', restrict: 'Restrict (reduce only)' };

export default function UserPermissionOverrides() {
  const { theme } = useSettings();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editing, setEditing] = useState(null); // { module_key, override_mode, record_scope, ...flags, reason, expiration_date }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canManage = perms.isSuperAdmin || perms.isAdministrator;

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users_overrides'],
    queryFn: () => base44.entities.User.list(500),
    initialData: []
  });

  // Only users the admin can manage (exclude self + admin-tier for non-super-admin).
  const manageableUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.id === perms.user?.id) return false;
      if (perms.isSuperAdmin) return true;
      const r = u.application_role || (u.role === 'admin' ? 'super_admin' : 'viewer_support');
      return r !== 'super_admin' && r !== 'administrator';
    });
  }, [users, perms.user?.id, perms.isSuperAdmin]);

  const targetUser = manageableUsers.find((u) => u.id === selectedUserId) || manageableUsers[0] || null;

  // Effective permissions for the selected user.
  const { data: effData, isLoading: effLoading, refetch: refetchEff } = useQuery({
    queryKey: ['effectivePermissionsFor', targetUser?.id],
    queryFn: () => base44.functions.invoke('getEffectivePermissions', { target_user_id: targetUser.id }),
    enabled: !!targetUser,
    retry: false
  });

  // Active overrides for the selected user.
  const { data: overrides = [], refetch: refetchOverrides } = useQuery({
    queryKey: ['overridesFor', targetUser?.id],
    queryFn: () => base44.entities.UserPermissionOverride.filter({ user_id: targetUser.id, status: 'active' }, 200),
    enabled: !!targetUser,
    initialData: []
  });

  const eff = effData?.data?.permissions || {};
  const customRoleName = effData?.data?.custom_role_name;

  const startEdit = (moduleKey, existing) => {
    setError(null);
    const base = eff[moduleKey] || {};
    setEditing({
      module_key: moduleKey,
      override_mode: existing?.override_mode || 'restrict',
      record_scope: existing?.record_scope || base.record_scope || 'none',
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
      can_assign: existing?.can_assign ?? false,
      can_export: existing?.can_export ?? false,
      can_approve: existing?.can_approve ?? false,
      can_manage_configuration: existing?.can_manage_configuration ?? false,
      reason: existing?.reason || '',
      expiration_date: existing?.expiration_date ? existing.expiration_date.substring(0, 10) : '',
      isExisting: !!existing
    });
  };

  const handleSave = async () => {
    if (!editing?.reason?.trim()) { setError('A reason is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        action: 'upsert',
        user_id: targetUser.id,
        module_key: editing.module_key,
        override_mode: editing.override_mode,
        record_scope: editing.record_scope,
        can_view: editing.can_view, can_create: editing.can_create, can_edit: editing.can_edit,
        can_delete: editing.can_delete, can_assign: editing.can_assign, can_export: editing.can_export,
        can_approve: editing.can_approve, can_manage_configuration: editing.can_manage_configuration,
        reason: editing.reason,
        expiration_date: editing.expiration_date ? new Date(editing.expiration_date).toISOString() : null
      };
      const res = await base44.functions.invoke('updateUserPermissionOverride', payload);
      if (res?.data?.error) throw new Error(res.data.error);
      setEditing(null);
      refetchOverrides();
      refetchEff();
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (ov) => {
    if (!window.confirm(`Deactivate the "${MODULE_BY_KEY[ov.module_key]?.name || ov.module_key}" override for ${targetUser.email}?`)) return;
    try {
      const res = await base44.functions.invoke('updateUserPermissionOverride', { action: 'deactivate', user_id: targetUser.id, module_key: ov.module_key, reason: `deactivated by ${perms.user?.email}` });
      if (res?.data?.error) throw new Error(res.data.error);
      refetchOverrides();
      refetchEff();
    } catch (e) {
      window.alert(e.message || 'Failed to deactivate');
    }
  };

  if (!canManage) return null;
  const selectClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';
  const cellText = theme === 'dark' ? 'text-slate-300' : 'text-slate-700';

  return (
    <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
      <CardHeader>
        <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Permission Overrides</CardTitle>
        <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
          Add per-user overrides that inherit, replace, or restrict role permissions. Self-escalation is blocked. A reason is required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* User selector */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <Label className="mb-1.5 block">Employee</Label>
            <Select value={targetUser?.id || ''} onValueChange={setSelectedUserId}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select a user..." /></SelectTrigger>
              <SelectContent>
                {manageableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{displayName(u)} — {u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetUser && (
            <div className={`rounded-xl border p-3 md:w-72 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <UserAvatar user={targetUser} size="sm" />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{displayName(targetUser)}</p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Base: {roleLabel(targetUser.application_role)}</p>
                  {customRoleName && <p className={`text-xs ${theme === 'dark' ? 'text-cyan-400' : 'text-indigo-600'}`}>Custom: {customRoleName}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {!targetUser ? (
          <div className={`rounded-lg border border-dashed p-6 text-center text-sm ${theme === 'dark' ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
            {manageableUsers.length === 0 ? 'No manageable users available.' : 'Select a user to view and edit their permission overrides.'}
          </div>
        ) : effLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="min-w-[860px] w-full text-sm border-collapse">
              <thead>
                <tr className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                  <th className="text-left font-semibold px-2 py-2">Module</th>
                  <th className="text-left font-semibold px-2 py-2">Effective Scope</th>
                  <th className="text-left font-semibold px-2 py-2">Source</th>
                  <th className="text-center font-semibold px-2 py-2">Override</th>
                  <th className="text-center font-semibold px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ACTIVE_MODULES.map((m) => {
                  const e = eff[m.key];
                  const ov = overrides.find((o) => o.module_key === m.key);
                  const isEditing = editing?.module_key === m.key;
                  return (
                    <React.Fragment key={m.key}>
                      <tr className={theme === 'dark' ? 'border-t border-slate-700' : 'border-t border-slate-100'}>
                        <td className="px-2 py-2">
                          <div className={`font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{m.name}</div>
                        </td>
                        <td className="px-2 py-2"><Badge variant="outline" className="text-[11px]">{SCOPE_LABELS[e?.record_scope] || '—'}</Badge></td>
                        <td className="px-2 py-2">
                          <span className={`text-[11px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{e?.source?.replace(/_/g, ' ') || '—'}</span>
                          {ov && <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-700">{ov.override_mode}</Badge>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {ov && (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{ov.reason ? 'reason set' : 'no reason'}</span>
                              {ov.expiration_date && <span className="text-[10px] text-amber-500">exp {ov.expiration_date.substring(0, 10)}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant={ov ? 'outline' : 'default'} className="h-7 px-2" onClick={() => startEdit(m.key, ov)}>
                              {ov ? <UserCog className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {ov ? 'Edit' : 'Add'}
                            </Button>
                            {ov && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDeactivate(ov)}><Ban className="w-3.5 h-3.5 text-rose-500" /></Button>}
                          </div>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className={theme === 'dark' ? 'bg-slate-900/40' : 'bg-slate-50'}>
                          <td colSpan={5} className="px-3 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Override Mode</Label>
                                <Select value={editing.override_mode} onValueChange={(v) => setEditing((p) => ({ ...p, override_mode: v }))}>
                                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="inherit">Inherit</SelectItem>
                                    <SelectItem value="replace">Replace</SelectItem>
                                    <SelectItem value="restrict">Restrict</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Record Scope</Label>
                                <Select value={editing.record_scope} onValueChange={(v) => setEditing((p) => ({ ...p, record_scope: v }))}>
                                  <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {RECORD_SCOPES.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Expiration (optional)</Label>
                                <Input type="date" className={selectClass} value={editing.expiration_date} onChange={(e) => setEditing((p) => ({ ...p, expiration_date: e.target.value }))} />
                              </div>
                              <div className="md:col-span-3 flex flex-wrap gap-4 items-center">
                                {ACTION_FLAGS.map((f) => (
                                  <label key={f} className="flex items-center gap-1.5 text-xs">
                                    <Checkbox checked={!!editing[f]} onCheckedChange={(v) => setEditing((p) => ({ ...p, [f]: !!v }))} />
                                    <span className={cellText}>{f.replace('can_', '').replace('manage_configuration', 'config')}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-xs">Reason (required)</Label>
                                <Input className={selectClass} placeholder="Why is this override being applied?" value={editing.reason} onChange={(e) => setEditing((p) => ({ ...p, reason: e.target.value }))} />
                              </div>
                              <div className="md:col-span-3 flex items-center justify-between gap-2">
                                {error && <span className="text-xs text-rose-500">{error}</span>}
                                <div className="flex gap-2 ml-auto">
                                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                                  <Button size="sm" disabled={saving} onClick={handleSave}>
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                                    Save Override
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}