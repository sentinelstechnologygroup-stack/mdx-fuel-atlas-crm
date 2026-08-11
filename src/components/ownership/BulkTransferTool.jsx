import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { atlas } from '@/api/atlasClient';
import { useDirectoryData } from '@/components/hooks/useDirectoryData';
import { displayName, isUserActive } from '@/lib/roles';
import { useToast } from '@/components/ui/use-toast';
import { useSettings } from '@/components/context/SettingsContext';
import { effectiveRole } from '@/lib/roles';

const ENTITY_OPTIONS = [
  { value: 'lead', label: 'Leads' },
  { value: 'opportunity', label: 'Opportunities' },
  { value: 'task', label: 'Tasks' },
  { value: 'activity', label: 'Activities' },
  { value: 'client', label: 'Clients' }
];
const ENTITY_MAP = { lead: 'Lead', opportunity: 'Opportunity', task: 'Task', activity: 'Activity', client: 'Client' };

// Administrator-only Bulk Record Transfer. Filters by owner / team /
// supervisor / entity / ownership status / active-or-inactive owner, selects
// records, requires destination user + team + supervisor + reason, and shows
// honest success/failure counts with failed record IDs after execution.
export default function BulkTransferTool() {
  const { users, teams, userById, teamById } = useDirectoryData();
  const { toast } = useToast();
  const { theme } = useSettings();

  const [entityType, setEntityType] = useState('lead');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeOwnerFilter, setActiveOwnerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [destUserId, setDestUserId] = useState('');
  const [destTeamId, setDestTeamId] = useState('');
  const [destSupervisorId, setDestSupervisorId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const entityName = ENTITY_MAP[entityType];

  const recordsQuery = useQuery({
    queryKey: ['bulkTransferRecords', entityType],
    queryFn: () => atlas.entities[entityName].list('-created_date', 500),
    initialData: []
  });
  const records = recordsQuery.data || [];

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (ownerFilter !== 'all' && r.owner_user_id !== ownerFilter) return false;
      if (teamFilter !== 'all' && r.assigned_team_id !== teamFilter) return false;
      if (statusFilter !== 'all' && (r.ownership_status || 'unassigned') !== statusFilter) return false;
      if (activeOwnerFilter !== 'all') {
        const owner = r.owner_user_id ? userById.get(r.owner_user_id) : null;
        const active = owner ? isUserActive(owner) : false;
        if (activeOwnerFilter === 'active' && !active) return false;
        if (activeOwnerFilter === 'inactive' && active) return false;
      }
      if (search) {
        const name = (r.full_name || r.lead_name || r.title || r.summary || '').toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, ownerFilter, teamFilter, statusFilter, activeOwnerFilter, search, userById]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => setSelected((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));

  const countsByType = useMemo(() => {
    const counts = { lead: 0, opportunity: 0, task: 0, activity: 0, client: 0 };
    // Only the selected entity type is transferred at once; show selected count for it.
    counts[entityType] = selected.size;
    return counts;
  }, [selected, entityType]);

  const activeUsers = users.filter(isUserActive);

  const handleExecute = async () => {
    if (selected.size === 0) { toast({ title: 'Select at least one record.', variant: 'destructive' }); return; }
    if (!destUserId) { toast({ title: 'Select a destination active user.', variant: 'destructive' }); return; }
    if (!reason.trim()) { toast({ title: 'A transfer reason is required.', variant: 'destructive' }); return; }
    setLoading(true); setResult(null);
    const operationId = (crypto.randomUUID?.() || `bulk-${Date.now()}`);
    try {
      const res = await atlas.functions.invoke('bulkTransferRecords', {
        entity_type: entityType,
        record_ids: Array.from(selected),
        to_owner_user_id: destUserId,
        to_team_id: destTeamId || null,
        to_supervisor_user_id: destSupervisorId || null,
        transfer_reason: reason,
        transfer_operation_id: operationId
      });
      const data = res?.data;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setSelected(new Set());
      recordsQuery.refetch();
      const status = data?.status || (data?.failure_count ? 'partial' : 'completed');
      let title = `Transferred ${data.success_count} record(s)`;
      let variant = 'default';
      if (status === 'reconciliation_required') { title = `Reconciliation required: ${data.reconciliation_required_count} need attention`; variant = 'destructive'; }
      else if (status === 'partial') { title = `Partial success: ${data.success_count} transferred, ${data.failure_count} failed`; variant = 'destructive'; }
      else if (data.already_processed_count > 0) { title = `${data.success_count} transferred · ${data.already_processed_count} already processed`; }
      toast({ title, variant });
    } catch (e) {
      toast({ title: 'Bulk transfer failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    theme === 'dark'
      ? 'bg-slate-900 border-slate-700 text-white'
      : 'bg-white';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" /> Bulk Record Transfer</CardTitle>
        <CardDescription>
          Transfer ownership of many records at once. Every successful transfer appends one transfer-history entry. Failures are reported honestly with their record IDs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setSelected(new Set()); }}>
            <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
            <SelectContent>{ENTITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="transfer_pending">Transfer Pending</SelectItem>
              <SelectItem value="inactive_owner">Inactive Owner</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeOwnerFilter} onValueChange={setActiveOwnerFilter}>
            <SelectTrigger className={inputClass}><SelectValue placeholder="Owner Active" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Active & Inactive Owners</SelectItem>
              <SelectItem value="active">Active Owner</SelectItem>
              <SelectItem value="inactive">Inactive Owner</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search records…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputClass} />
        </div>

        {/* Record table */}
        <div className="rounded-md border overflow-hidden max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                <TableHead className="text-left">Record</TableHead>
                <TableHead className="text-left">Owner</TableHead>
                <TableHead className="text-left">Team</TableHead>
                <TableHead className="text-left">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-400 py-6">No records match these filters.</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const owner = r.owner_user_id ? userById.get(r.owner_user_id) : null;
                const team = r.assigned_team_id ? teamById.get(r.assigned_team_id) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                    <TableCell className="truncate max-w-[180px]">{r.full_name || r.lead_name || r.title || r.summary || r.id}</TableCell>
                    <TableCell className="text-sm">{owner ? displayName(owner) : <span className="text-amber-600">Unassigned</span>}</TableCell>
                    <TableCell className="text-sm">{team?.name || '—'}</TableCell>
                    <TableCell className="text-sm">{r.ownership_status || 'unassigned'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Destination + confirmation */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label>Destination User</Label>
            <Select value={destUserId} onValueChange={setDestUserId}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Active user" /></SelectTrigger>
              <SelectContent>{activeUsers.map((u) => <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Destination Team</Label>
            <Select value={destTeamId} onValueChange={setDestTeamId}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Team" /></SelectTrigger>
              <SelectContent>{teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Destination Supervisor</Label>
            <Select value={destSupervisorId} onValueChange={setDestSupervisorId}>
              <SelectTrigger className={inputClass}><SelectValue placeholder="Supervisor" /></SelectTrigger>
              <SelectContent>
                {activeUsers
                  .filter((user) =>
                    ['supervisor', 'administrator', 'super_admin']
                      .includes(effectiveRole(user))
                  )
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {displayName(user)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Transfer Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className={inputClass} />
          </div>
        </div>

        {/* Confirmation summary */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle className="w-4 h-4" /> Confirmation Summary</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            {ENTITY_OPTIONS.map((o) => (
              <div key={o.value} className="rounded bg-white border border-blue-100 p-2 text-center">
                <p className="font-bold">{countsByType[o.value]}</p>
                <p>{o.label}</p>
              </div>
            ))}
          </div>
        </div>

        {result && (
          <div className={`rounded-lg p-3 text-sm space-y-1 ${result.reconciliation_required_count ? 'bg-orange-50 text-orange-700 border border-orange-200' : result.failure_count ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            <p className="font-medium">
              Completed: {result.success_count} · Failed: {result.failure_count} · Already processed: {result.already_processed_count || 0} · Reconciliation required: {result.reconciliation_required_count || 0}
            </p>
            {result.failed?.length > 0 && (
              <p className="text-xs">Failed records: {result.failed.map((f) => `${f.id} (${f.error})`).join(', ')}</p>
            )}
            {result.reconciliation_required?.length > 0 && (
              <p className="text-xs">Reconciliation required: {result.reconciliation_required.map((f) => f.id).join(', ')}</p>
            )}
            {result.already_processed?.length > 0 && (
              <p className="text-xs">Already processed (skipped): {result.already_processed.map((f) => f.id).join(', ')}</p>
            )}
            <p className="text-[11px] opacity-70">Operation ID: {result.operation_id}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleExecute} disabled={loading || selected.size === 0} className="bg-slate-900 text-white">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Transfer {selected.size} Record(s)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
