import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Save, Loader2, RefreshCw, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { MODULES, ACTIVE_MODULES, MODULE_CATEGORIES, CATEGORY_BY_KEY, ACTION_FLAGS, RECORD_SCOPES } from '@/lib/permissionModules';

const SENSITIVE_MODULES = ['roles_permissions', 'security_settings'];
const SCOPE_LABELS = { none: 'None', own: 'Own', team: 'Team', all: 'All' };

export default function PermissionMatrix() {
  const { theme } = useSettings();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRoleKey, setSelectedRoleKey] = useState('administrator');
  const [draft, setDraft] = useState({}); // module_key -> { record_scope, ...flags }
  const [saving, setSaving] = useState(null);
  const [rowError, setRowError] = useState({});
  const [savedFlash, setSavedFlash] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(null); // pending broadening confirmation

  const actorRole = perms.applicationRole;

  // Load role definitions (system + all custom, to show inactive too).
  const { data: roleDefs = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roleDefinitions'],
    queryFn: () => atlas.entities.RoleDefinition.list(200)
  });

  // Initialize the permission model once if no permissions exist.
  const { data: allPerms = [], refetch: refetchPerms } = useQuery({
    queryKey: ['allModulePermissions'],
    queryFn: () => atlas.entities.ModulePermission.list(500),
    initialData: []
  });

  // One-time auto-initialize when an admin opens with an empty model.
  useEffect(() => {
    if (!rolesLoading && roleDefs.length === 0 && allPerms.length === 0 && (perms.isSuperAdmin || perms.isAdministrator)) {
      (async () => {
        try {
          await atlas.functions.invoke('initializePermissionModel', {});
          queryClient.invalidateQueries(['roleDefinitions']);
          queryClient.invalidateQueries(['allModulePermissions']);
        } catch (_e) { /* ignore */ }
      })();
    }
  }, [rolesLoading, roleDefs.length, allPerms.length, perms.isSuperAdmin, perms.isAdministrator, queryClient]);

  const roles = useMemo(() => {
    const systemOrder = ['super_admin', 'administrator', 'supervisor', 'salesperson', 'viewer_support'];
    return [...roleDefs].sort((a, b) => {
      if (a.is_system_role && b.is_system_role) return systemOrder.indexOf(a.role_key) - systemOrder.indexOf(b.role_key);
      if (a.is_system_role) return -1;
      if (b.is_system_role) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [roleDefs]);

  const selectedRole = roles.find((r) => r.role_key === selectedRoleKey) || null;

  // Permissions for the selected role.
  const rolePerms = useMemo(() => {
    const map = {};
    for (const p of allPerms) {
      if (p.role_key === selectedRoleKey && p.status === 'active') map[p.module_key] = p;
    }
    return map;
  }, [allPerms, selectedRoleKey]);

  // Reset draft when role changes.
  useEffect(() => {
    setDraft({});
    setRowError({});
    setSavedFlash({});
  }, [selectedRoleKey]);

  // Authority: can the actor edit this role's permissions?
  const canEditRole = (rd) => {
    if (!rd) return false;
    if (perms.isSuperAdmin) return true;
    if (!perms.isAdministrator) return false;
    // Administrator: cannot edit super_admin or administrator; cannot edit admin-inheriting custom roles.
    if (rd.role_key === 'super_admin' || rd.role_key === 'administrator') return false;
    if (rd.role_type === 'custom' && (rd.base_role_key === 'super_admin' || rd.base_role_key === 'administrator')) return false;
    return rd.status === 'active';
  };

  const isLocked = !selectedRole || !canEditRole(selectedRole);
  const isSuperAdminRow = selectedRole?.role_key === 'super_admin';

  const getValue = (moduleKey, field) => {
    const d = draft[moduleKey];
    if (d && d[field] !== undefined) return d[field];
    const base = rolePerms[moduleKey];
    return base ? base[field] : (field === 'record_scope' ? 'none' : false);
  };

  const isDirty = (moduleKey) => {
    const d = draft[moduleKey];
    if (!d) return false;
    const base = rolePerms[moduleKey];
    for (const f of ['record_scope', ...ACTION_FLAGS]) {
      const baseVal = base ? base[f] : (f === 'record_scope' ? 'none' : false);
      if ((d[f] ?? baseVal) !== baseVal) return true;
    }
    return false;
  };

  const setField = (moduleKey, field, value) => {
    setDraft((prev) => {
      const base = rolePerms[moduleKey];
      const cur = prev[moduleKey] || {};
      const fallback = base ? base[field] : (field === 'record_scope' ? 'none' : false);
      return { ...prev, [moduleKey]: { record_scope: base?.record_scope || 'none', can_view: base?.can_view ?? false, can_create: base?.can_create ?? false, can_edit: base?.can_edit ?? false, can_delete: base?.can_delete ?? false, can_assign: base?.can_assign ?? false, can_export: base?.can_export ?? false, can_approve: base?.can_approve ?? false, can_manage_configuration: base?.can_manage_configuration ?? false, ...cur, [field]: value } };
    });
  };

  const handleSave = async (moduleKey, opts = {}) => {
    const d = draft[moduleKey];
    if (!d) return;
    setSaving(moduleKey);
    setRowError((p) => ({ ...p, [moduleKey]: null }));
    try {
      const payload = {
        role_key: selectedRoleKey,
        module_key: moduleKey,
        record_scope: d.record_scope,
        can_view: d.can_view, can_create: d.can_create, can_edit: d.can_edit, can_delete: d.can_delete,
        can_assign: d.can_assign, can_export: d.can_export, can_approve: d.can_approve,
        can_manage_configuration: d.can_manage_configuration,
        reason: opts.reason || `Matrix edit by ${perms.user?.email || 'admin'}`
      };
      const res = await atlas.functions.invoke('updateModulePermission', payload);
      if (res?.data?.error) throw new Error(res.data.error);
      setDraft((p) => { const n = { ...p }; delete n[moduleKey]; return n; });
      setSavedFlash((p) => ({ ...p, [moduleKey]: true }));
      setTimeout(() => setSavedFlash((p) => { const n = { ...p }; delete n[moduleKey]; return n; }), 2000);
      queryClient.invalidateQueries(['allModulePermissions']);
    } catch (e) {
      setRowError((p) => ({ ...p, [moduleKey]: e.message || 'Save failed' }));
    } finally {
      setSaving(null);
    }
  };

  const onSaveClick = (moduleKey) => {
    // Confirm broadening sensitive permissions.
    if (SENSITIVE_MODULES.includes(moduleKey)) {
      const base = rolePerms[moduleKey];
      const d = draft[moduleKey];
      if (d.can_manage_configuration && !(base?.can_manage_configuration)) {
        setConfirmOpen({ moduleKey, message: `Granting configuration authority over ${moduleKey} is sensitive. Only a Super Administrator may do this. Continue?`, onConfirm: () => { setConfirmOpen(null); handleSave(moduleKey); } });
        return;
      }
    }
    handleSave(moduleKey);
  };

  const initModel = async () => {
    setSaving('__init__');
    try {
      await atlas.functions.invoke('initializePermissionModel', {});
      queryClient.invalidateQueries(['roleDefinitions']);
      queryClient.invalidateQueries(['allModulePermissions']);
    } catch (e) {
      setRowError({ __init__: e.message });
    } finally {
      setSaving(null);
    }
  };

  const selectClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';
  const cellText = theme === 'dark' ? 'text-slate-300' : 'text-slate-700';

  const grouped = MODULE_CATEGORIES
    .filter((c) => c.key !== 'future_reserved')
    .map((c) => ({ ...c, modules: ACTIVE_MODULES.filter((m) => m.category === c.key) }))
    .filter((g) => g.modules.length > 0);

  return (
    <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Permission Matrix</CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
              Configure module-level permissions for each role. All changes are saved through protected backend functions.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedRoleKey} onValueChange={setSelectedRoleKey}>
              <SelectTrigger className={`w-64 ${selectClass}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.role_key} value={r.role_key} disabled={r.status === 'inactive' && r.role_type === 'custom'}>
                    <span className="flex items-center gap-2">
                      {r.name}
                      {r.is_system_role && <Badge variant="secondary" className="ml-1 text-[10px]">system</Badge>}
                      {r.role_type === 'custom' && <Badge variant="outline" className="ml-1 text-[10px]">custom</Badge>}
                      {r.status === 'inactive' && <span className="text-xs text-rose-500">(inactive)</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={initModel} disabled={saving === '__init__'}>
              {saving === '__init__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Initialize Defaults
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetchPerms()}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
        {isLocked && selectedRole && (
          <div className={`mt-2 flex items-center gap-2 text-xs rounded-md px-3 py-2 ${theme === 'dark' ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
            <Lock className="w-3.5 h-3.5" />
            {isSuperAdminRow
              ? 'Super Administrator permissions are protected and cannot be disabled.'
              : selectedRole.role_key === 'administrator'
                ? 'Administrator permissions can only be modified by a Super Administrator.'
                : 'This role cannot be edited by your account. Only a Super Administrator may manage this role.'}
          </div>
        )}
        {rowError.__init__ && <div className="mt-2 text-xs text-rose-500">{rowError.__init__}</div>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="min-w-[920px] w-full text-sm border-collapse">
            <thead>
              <tr className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                <th className="text-left font-semibold px-2 py-2 sticky left-0 z-10 bg-inherit">Module</th>
                <th className="text-center font-semibold px-2 py-2">Scope</th>
                {['View', 'Create', 'Edit', 'Delete', 'Assign', 'Export', 'Approve', 'Config'].map((h) => (
                  <th key={h} className="text-center font-semibold px-2 py-2" title={h}>{h}</th>
                ))}
                <th className="text-center font-semibold px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <React.Fragment key={group.key}>
                  <tr>
                    <td colSpan={11} className={`px-2 pt-4 pb-1 text-xs font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-500'}`}>{group.label}</td>
                  </tr>
                  {group.modules.map((m) => {
                    const locked = isLocked;
                    const dirty = isDirty(m.key);
                    const err = rowError[m.key];
                    const saved = savedFlash[m.key];
                    const isSaving = saving === m.key;
                    return (
                      <tr key={m.key} className={`${theme === 'dark' ? 'border-t border-slate-700' : 'border-t border-slate-100'} ${dirty ? (theme === 'dark' ? 'bg-amber-500/5' : 'bg-amber-50') : ''}`}>
                        <td className="px-2 py-2 sticky left-0 z-10 bg-inherit">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{m.name}</span>
                            {SENSITIVE_MODULES.includes(m.key) && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <span className={`text-[11px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{m.description}</span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {locked ? (
                            <span className={`text-xs ${cellText}`}>{SCOPE_LABELS[getValue(m.key, 'record_scope')]}</span>
                          ) : (
                            <Select value={getValue(m.key, 'record_scope')} onValueChange={(v) => setField(m.key, 'record_scope', v)}>
                              <SelectTrigger className={`w-20 h-8 ${selectClass} text-xs`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {RECORD_SCOPES.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABELS[s]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        {ACTION_FLAGS.map((f) => {
                          const val = getValue(m.key, f);
                          return (
                            <td key={f} className="px-2 py-2 text-center">
                              <Checkbox
                                checked={!!val}
                                disabled={locked || (isSuperAdminRow)}
                                onCheckedChange={(v) => setField(m.key, f, !!v)}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center">
                          {locked ? (
                            <Lock className="w-4 h-4 mx-auto text-slate-400" />
                          ) : dirty ? (
                            <div className="flex flex-col items-center gap-1">
                              <Button size="sm" variant="default" className="h-7 px-2" disabled={isSaving} onClick={() => onSaveClick(m.key)}>
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                Save
                              </Button>
                              {err && <span className="text-[10px] text-rose-500 max-w-[120px] truncate" title={err}>{err}</span>}
                              {saved && <span className="text-[10px] text-emerald-500">Saved</span>}
                            </div>
                          ) : (
                            <span className={`text-[11px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{saved ? 'Saved' : '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`max-w-md w-full rounded-xl border p-5 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-bold">Confirm sensitive change</h4>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{confirmOpen.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setConfirmOpen(null)}>Cancel</Button>
              <Button variant="default" onClick={confirmOpen.onConfirm}>Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
