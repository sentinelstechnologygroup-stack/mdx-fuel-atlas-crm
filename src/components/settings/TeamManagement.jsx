import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { listManagedUsers } from '@/api/userDirectoryService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Power, Loader2, Users } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { displayName, effectiveRole } from '@/lib/roles';

export default function TeamManagement() {
  const { theme } = useSettings();
  const { canManageTeams } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams_mgmt'],
    queryFn: () => atlas.entities.Team.list(),
    initialData: []
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users_for_teams'],
    queryFn: listManagedUsers,
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => id ? atlas.entities.Team.update(id, data) : atlas.entities.Team.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams_mgmt']);
      queryClient.invalidateQueries(['teams_directory']);
      setOpen(false);
    }
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.entities.Team.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams_mgmt']);
      queryClient.invalidateQueries(['teams_directory']);
    }
  });

  const managerName = (id) => {
    const u = users.find((x) => x.id === id);
    return u ? displayName(u) : '—';
  };
  const memberCount = (teamId) => users.filter((u) => u.team_id === teamId).length;

  const openCreate = () => {
    setEditing({ name: '', code: '', department: '', region: '', description: '', manager_user_id: '', status: 'active' });
    setOpen(true);
  };
  const openEdit = (team) => {
    setEditing({ ...team });
    setOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      code: fd.get('code') || null,
      department: fd.get('department') || null,
      region: fd.get('region') || null,
      description: fd.get('description') || null,
      manager_user_id: editing.manager_user_id || null,
      status: editing.status || 'active'
    };
    saveMutation.mutate({ id: editing.id, data }, { onError: (err) => alert('Failed to save team: ' + err.message) });
  };

  const toggleStatus = (team) => {
    const nextStatus =
      team.status === 'active'
        ? 'inactive'
        : 'active';

    if (
      nextStatus === 'inactive' &&
      !confirm(
        `Deactivate ${team.name}? Existing employee and CRM assignments will remain intact.`
      )
    ) {
      return;
    }

    statusMutation.mutate(
      {
        id: team.id,
        data: {
          status: nextStatus
        }
      },
      {
        onError: (error) =>
          alert(
            `Unable to change team status: ${error.message}`
          )
      }
    );
  };

  const inputClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Teams</h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Create and manage sales teams across the organization.</p>
        </div>
        {canManageTeams && (
          <Button onClick={openCreate} className="bg-slate-900 text-white">
            <Plus className="w-4 h-4 mr-2" /> New Team
          </Button>
        )}
      </div>

      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Table>
          <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
            <TableRow>
              <TableHead className="text-left">Team</TableHead>
              <TableHead className="text-left hidden md:table-cell">Code</TableHead>
              <TableHead className="text-left hidden md:table-cell">Department</TableHead>
              <TableHead className="text-left hidden lg:table-cell">Manager</TableHead>
              <TableHead className="text-left">Members</TableHead>
              <TableHead className="text-left">Status</TableHead>
              {canManageTeams && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
            )}
            {!isLoading && teams.length === 0 && (
              <TableRow><TableCell colSpan={7} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No teams created yet.</TableCell></TableRow>
            )}
            {teams.map((team) => (
              <TableRow key={team.id} className={theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>{team.name}</span>
                  </div>
                  {team.description && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{team.description}</p>}
                </TableCell>
                <TableCell className={`hidden md:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{team.code || '—'}</TableCell>
                <TableCell className={`hidden md:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{team.department || '—'}</TableCell>
                <TableCell className={`hidden lg:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{managerName(team.manager_user_id)}</TableCell>
                <TableCell className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{memberCount(team.id)}</TableCell>
                <TableCell>
                  <Badge className={team.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                    {team.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canManageTeams && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(team)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(team)}><Power className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Team' : 'New Team'}</DialogTitle>
            <DialogDescription>Teams group salespeople under a manager and can be tied to territories.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Team Name *</Label>
                <Input name="name" required defaultValue={editing?.name} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input name="code" defaultValue={editing?.code} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input name="department" defaultValue={editing?.department} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label>Region</Label>
                <Input name="region" defaultValue={editing?.region} className={inputClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Manager</Label>
              <Select value={editing?.manager_user_id || 'none'} onValueChange={(v) => setEditing({ ...editing, manager_user_id: v === 'none' ? '' : v })}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {users.filter((u) => ['supervisor', 'administrator', 'super_admin'].includes(effectiveRole(u))).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={editing?.description} className={inputClass} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-slate-900 text-white">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
