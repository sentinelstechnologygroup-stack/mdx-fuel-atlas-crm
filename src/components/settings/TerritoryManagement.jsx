import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { atlas } from '@/api/atlasClient';
import { listManagedUsers } from '@/api/userDirectoryService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Power, Loader2, MapPin } from 'lucide-react';
import { useSettings } from '@/components/context/SettingsContext';
import { usePermissions } from '@/components/hooks/usePermissions';
import { displayName, effectiveRole, territoryTypeLabel, TERRITORY_TYPES } from '@/lib/roles';

export default function TerritoryManagement() {
  const { theme } = useSettings();
  const { canManageTerritories } = usePermissions();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);

  const { data: territories = [], isLoading } = useQuery({
    queryKey: ['territories_mgmt'],
    queryFn: () => atlas.entities.Territory.list(),
    initialData: []
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams_for_territories'],
    queryFn: () => atlas.entities.Team.list(),
    initialData: []
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users_for_territories'],
    queryFn: listManagedUsers,
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => id ? atlas.entities.Territory.update(id, data) : atlas.entities.Territory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['territories_mgmt']);
      queryClient.invalidateQueries(['territories_directory']);
      setOpen(false);
    }
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, data }) => atlas.entities.Territory.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['territories_mgmt']);
      queryClient.invalidateQueries(['territories_directory']);
    }
  });

  const teamName = (id) => teams.find((t) => t.id === id)?.name || '—';
  const managerName = (id) => { const u = users.find((x) => x.id === id); return u ? displayName(u) : '—'; };
  const memberCount = (territoryId) => users.filter((u) => (u.territory_ids || []).includes(territoryId)).length;

  const openCreate = () => {
    setEditing({ name: '', code: '', territory_type: 'geographic', service_area: '', counties: '', cities: '', postal_codes: '', primary_manager_user_id: '', team_id: '', status: 'active' });
    setOpen(true);
  };
  const openEdit = (t) => {
    setEditing({
      ...t,
      counties: (t.counties || []).join(', '),
      cities: (t.cities || []).join(', '),
      postal_codes: (t.postal_codes || []).join(', ')
    });
    setOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const splitList = (v) => v.split(',').map((s) => s.trim()).filter(Boolean);
    const data = {
      name: fd.get('name'),
      code: fd.get('code') || null,
      territory_type: editing.territory_type || 'geographic',
      service_area: fd.get('service_area') || null,
      counties: splitList(fd.get('counties') || ''),
      cities: splitList(fd.get('cities') || ''),
      postal_codes: splitList(fd.get('postal_codes') || ''),
      primary_manager_user_id: editing.primary_manager_user_id || null,
      team_id: editing.team_id || null,
      status: editing.status || 'active'
    };
    saveMutation.mutate({ id: editing.id, data }, { onError: (err) => alert('Failed to save territory: ' + err.message) });
  };

  const toggleStatus = (territory) => {
    const nextStatus =
      territory.status === 'active'
        ? 'inactive'
        : 'active';

    if (
      nextStatus === 'inactive' &&
      !confirm(
        `Deactivate ${territory.name}? Existing employee, team, and CRM assignments will remain intact.`
      )
    ) {
      return;
    }

    statusMutation.mutate(
      {
        id: territory.id,
        data: {
          status: nextStatus
        }
      },
      {
        onError: (error) =>
          alert(
            `Unable to change territory status: ${error.message}`
          )
      }
    );
  };

  const inputClass = theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Territories & Service Areas</h3>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Sales territories and service areas assignable to users and teams.</p>
        </div>
        {canManageTerritories && (
          <Button onClick={openCreate} className="bg-slate-900 text-white">
            <Plus className="w-4 h-4 mr-2" /> New Territory
          </Button>
        )}
      </div>

      <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <Table>
          <TableHeader className={theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}>
            <TableRow>
              <TableHead className="text-left">Territory</TableHead>
              <TableHead className="text-left hidden md:table-cell">Type</TableHead>
              <TableHead className="text-left hidden lg:table-cell">Service Area</TableHead>
              <TableHead className="text-left hidden lg:table-cell">Manager</TableHead>
              <TableHead className="text-left hidden xl:table-cell">Team</TableHead>
              <TableHead className="text-left">Members</TableHead>
              <TableHead className="text-left">Status</TableHead>
              {canManageTerritories && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></TableCell></TableRow>
            )}
            {!isLoading && territories.length === 0 && (
              <TableRow><TableCell colSpan={8} className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>No territories created yet.</TableCell></TableRow>
            )}
            {territories.map((t) => (
              <TableRow key={t.id} className={theme === 'dark' ? 'border-slate-700' : 'border-slate-100'}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
                    <span className={theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}>{t.name}</span>
                  </div>
                  {t.description && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{t.description}</p>}
                </TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="outline" className={theme === 'dark' ? 'border-slate-600 text-slate-300' : 'text-slate-600'}>{territoryTypeLabel(t.territory_type)}</Badge></TableCell>
                <TableCell className={`hidden lg:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t.service_area || '—'}</TableCell>
                <TableCell className={`hidden lg:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{managerName(t.primary_manager_user_id)}</TableCell>
                <TableCell className={`hidden xl:table-cell ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{teamName(t.team_id)}</TableCell>
                <TableCell className={theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}>{memberCount(t.id)}</TableCell>
                <TableCell>
                  <Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                    {t.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {canManageTerritories && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(t)}><Power className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit Territory' : 'New Territory'}</DialogTitle>
            <DialogDescription>Sales territory or service area. Enter counties, cities, and postal codes as comma-separated lists.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Territory Name *</Label>
                <Input name="name" required defaultValue={editing?.name} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input name="code" defaultValue={editing?.code} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={editing?.territory_type || 'geographic'} onValueChange={(v) => setEditing({ ...editing, territory_type: v })}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TERRITORY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Area</Label>
                <Input
                  name="service_area"
                  defaultValue={editing?.service_area}
                  placeholder="e.g., Greater Houston"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label>Counties (comma-separated)</Label>
                <Input
                  name="counties"
                  defaultValue={editing?.counties}
                  placeholder="Harris, Montgomery, Fort Bend"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cities (comma-separated)</Label>
                <Input
                  name="cities"
                  defaultValue={editing?.cities}
                  placeholder="Houston, Magnolia, Tomball"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Postal Codes (comma-separated)</Label>
                <Input
                  name="postal_codes"
                  defaultValue={editing?.postal_codes}
                  placeholder="77002, 77354, 77375"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary Manager</Label>
                <Select value={editing?.primary_manager_user_id || 'none'} onValueChange={(v) => setEditing({ ...editing, primary_manager_user_id: v === 'none' ? '' : v })}>
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
                <Label>Team</Label>
                <Select value={editing?.team_id || 'none'} onValueChange={(v) => setEditing({ ...editing, team_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
