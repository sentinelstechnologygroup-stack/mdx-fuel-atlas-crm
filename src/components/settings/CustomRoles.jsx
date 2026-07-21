import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Plus, Loader2, Power, Trash2, Users as UsersIcon } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { roleLabel } from '@/lib/roles';

export default function CustomRoles() {
  const { theme } = useSettings();
  const perms = usePermissions();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', base_role_key: 'supervisor' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [affected, setAffected] = useState(null);

  const canManage = perms.isSuperAdmin || perms.isAdministrator;

  const { data: roleDefs = [], refetch } = useQuery({
    queryKey: ['roleDefinitions'],
    queryFn: () => atlas.entities.RoleDefinition.list(200)
  });

  const customRoles = roleDefs.filter((r) => r.role_type === 'custom');

  const baseOptions = perms.isSuperAdmin
    ? ['administrator', 'supervisor', 'salesperson', 'viewer_support']
    : ['supervisor', 'salesperson', 'viewer_support'];

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await atlas.functions.invoke('createCustomRole', form);
      if (res?.data?.error) throw new Error(res.data.error);
      setCreateOpen(false);
      setForm({ name: '', description: '', base_role_key: 'supervisor' });
      queryClient.invalidateQueries(['roleDefinitions']);
    } catch (e) {
      setError(e.message || 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  const handleStatus = async (rd, action) => {
    if (action === 'deactivate') {
      const ok = window.confirm(`Deactivate "${rd.name}"? Users assigned this role will fall back to their base application role.`);
      if (!ok) return;
    }
    setBusy(rd.id + action);
    try {
      const res = await atlas.functions.invoke('updateRoleDefinition', { role_definition_id: rd.id, action, reason: `${action} by ${perms.user?.email || 'admin'}` });
      if (res?.data?.error) throw new Error(res.data.error);
      if (action === 'deactivate' && res?.data?.affected_users?.length) {
        setAffected({ role: rd.name, users: res.data.affected_users });
      }
      queryClient.invalidateQueries(['roleDefinitions']);
    } catch (e) {
      window.alert(e.message || 'Failed to update role');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (rd) => {
    const ok = window.confirm(`Permanently delete "${rd.name}"? This is only allowed when no active users are assigned.`);
    if (!ok) return;
    setBusy(rd.id + 'delete');
    try {
      const res = await atlas.functions.invoke('updateRoleDefinition', { role_definition_id: rd.id, action: 'delete', reason: `delete by ${perms.user?.email || 'admin'}` });
      if (res?.data?.error) throw new Error(res.data.error);
      queryClient.invalidateQueries(['roleDefinitions']);
    } catch (e) {
      window.alert(e.message || 'Failed to delete role');
    } finally {
      setBusy(null);
    }
  };

  if (!canManage) return null;
  const selectClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

  return (
    <Card className={theme === 'dark' ? 'bg-slate-800 border-slate-700' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>Custom Roles</CardTitle>
            <CardDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
              Create custom roles that inherit from a base system role. Administrators may only create roles inheriting from Supervisor, Salesperson, or Viewer/Support.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Custom Role</Button>
        </div>
      </CardHeader>
      <CardContent>
        {customRoles.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-6 text-center text-sm ${theme === 'dark' ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
            No custom roles yet. Create roles like Account Manager, Sales Coordinator, or Executive Viewer.
          </div>
        ) : (
          <div className="space-y-3">
            {customRoles.map((rd) => {
              const adminInherited = rd.base_role_key === 'super_admin' || rd.base_role_key === 'administrator';
              const canTouch = perms.isSuperAdmin || !adminInherited;
              return (
                <div key={rd.id} className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${theme === 'dark' ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{rd.name}</span>
                      <Badge variant="outline" className="text-[10px]">key: {rd.role_key}</Badge>
                      <Badge variant="secondary" className="text-[10px]">inherits {roleLabel(rd.base_role_key)}</Badge>
                      <Badge className={rd.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}>{rd.status}</Badge>
                    </div>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{rd.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canTouch ? (
                      <>
                        <Button size="sm" variant="outline" disabled={busy === rd.id + (rd.status === 'active' ? 'deactivate' : 'activate')} onClick={() => handleStatus(rd, rd.status === 'active' ? 'deactivate' : 'activate')}>
                          {busy === rd.id + (rd.status === 'active' ? 'deactivate' : 'activate') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                          {rd.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === rd.id + 'delete'} onClick={() => handleDelete(rd)}>
                          {busy === rd.id + 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </Button>
                      </>
                    ) : (
                      <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Super Administrator only</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
            <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
              The new role inherits and clones the base role's current permissions. You can refine them in the matrix afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Role Name</Label>
              <Input className={selectClass} placeholder="e.g. Account Manager" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className={selectClass} rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Base System Role</Label>
              <Select value={form.base_role_key} onValueChange={(v) => setForm((f) => ({ ...f, base_role_key: v }))}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {baseOptions.map((b) => <SelectItem key={b} value={b}>{roleLabel(b)}</SelectItem>)}
                </SelectContent>
              </Select>
              {!perms.isSuperAdmin && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Only a Super Administrator can create roles inheriting from Administrator.</p>}
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.name.trim()}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create & Clone Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Affected users dialog */}
      <Dialog open={!!affected} onOpenChange={() => setAffected(null)}>
        <DialogContent className={theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : ''}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Users affected by deactivation</DialogTitle>
            <DialogDescription className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
              "{affected?.role}" was deactivated. These users fall back to their base application role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {affected?.users?.map((u) => (
              <div key={u.id} className={`text-sm px-3 py-1.5 rounded ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>{u.email}</div>
            ))}
          </div>
          <DialogFooter><Button onClick={() => setAffected(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
