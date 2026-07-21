import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UserCog, Loader2, Lock } from 'lucide-react';
import { atlas } from '@/api/atlasClient';
import { usePermissions } from '@/components/hooks/usePermissions';
import { useDirectoryData } from '@/components/hooks/useDirectoryData';
import { canReassignRecord, isUserActive, displayName } from '@/lib/roles';
import { useToast } from '@/components/ui/use-toast';

const ENTITY_LABELS = {
  lead: 'Lead',
  opportunity: 'Opportunity',
  task: 'Task',
  activity: 'Activity',
  client: 'Client'
};

// Reusable assign/reassign control. Drops into any record detail view.
// Authority is enforced both client-side (button hidden for unauthorized
// roles) and server-side (reassignRecord rejects forbidden transfers).
export default function OwnershipAssignControl({ entityType, record, onUpdated }) {
  const { user: actor } = usePermissions();
  const { users, teams } = useDirectoryData();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerId, setOwnerId] = useState(record?.owner_user_id || '');
  const [teamId, setTeamId] = useState(record?.assigned_team_id || '');
  const [supervisorId, setSupervisorId] = useState(record?.assigned_supervisor_user_id || '');
  const [reason, setReason] = useState('');

  if (!record) return null;

  const canReassign = actor ? canReassignRecord(actor, record, users) : false;
  if (!canReassign) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Lock className="w-3.5 h-3.5" />
        <span>Reassignment requires supervisor or administrator access.</span>
      </div>
    );
  }

  // Supervisors may only choose active members of their own team.
  const assignableUsers = users.filter((u) => {
    if (!isUserActive(u)) return false;
    if (actor?.application_role === 'supervisor') return u.team_id === actor.team_id;
    return true;
  });
  const assignableTeams = actor?.application_role === 'supervisor'
    ? teams.filter((t) => t.id === actor.team_id)
    : teams;

  const handleSave = async () => {
    if (!ownerId) { toast({ title: 'Select an owner', variant: 'destructive' }); return; }
    setSaving(true);
    const operationId = (crypto.randomUUID?.() || `reassign-${Date.now()}`);
    try {
      const res = await atlas.functions.invoke('reassignRecord', {
        entity_type: entityType,
        entity_id: record.id,
        to_owner_user_id: ownerId,
        to_team_id: teamId || null,
        to_supervisor_user_id: supervisorId || null,
        transfer_reason: reason,
        transfer_type: 'manual',
        transfer_operation_id: operationId
      });
      const data = res?.data;
      if (data?.error) throw new Error(data.error);
      const status = data?.status || 'completed';
      if (status === 'already_processed') {
        toast({ title: 'Already processed', description: 'This transfer was already completed earlier.' });
      } else if (status === 'reconciliation_required') {
        toast({ title: 'Reconciliation required', description: data.error || 'Transfer history failed and ownership could not be restored.', variant: 'destructive' });
      } else if (status === 'failed') {
        toast({ title: 'Transfer failed', description: data.error || 'Ownership was restored.', variant: 'destructive' });
      } else {
        toast({ title: 'Ownership updated', description: 'A transfer-history entry was recorded.' });
      }
      setOpen(false);
      if (onUpdated) onUpdated();
    } catch (e) {
      toast({ title: 'Reassignment failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <UserCog className="w-4 h-4" />
        Assign / Reassign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {ENTITY_LABELS[entityType] || 'Record'}</DialogTitle>
            <DialogDescription>
              Transfer ownership of this record. The original creator and full history are preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select an active user" /></SelectTrigger>
                <SelectContent>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{displayName(u)}{u.email ? ` · ${u.email}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger><SelectValue placeholder="No team" /></SelectTrigger>
                  <SelectContent>
                    {assignableTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger><SelectValue placeholder="No supervisor" /></SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Transfer Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this record being reassigned?" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Transfer Ownership
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
