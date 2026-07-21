import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';
import { atlas } from '@/api/atlasClient';
import { useDirectoryData } from '@/components/hooks/useDirectoryData';
import { displayName, isUserActive } from '@/lib/roles';
import { useToast } from '@/components/ui/use-toast';

const ENTITY_LABELS = {
  lead: 'Leads',
  opportunity: 'Opportunities',
  task: 'Tasks',
  activity: 'Activities',
  client: 'Clients'
};

// Enhanced deactivation: previews owned-record counts, requires a reason, and
// offers mark-inactive / transfer-selected / transfer-all options. Never
// deletes the user or any records. Final-super-admin protection is enforced
// server-side.
export default function DeactivateUserDialog({ user, open, onOpenChange, onDone }) {
  const { users } = useDirectoryData();
  const { toast } = useToast();
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [reason, setReason] = useState('');
  const [option, setOption] = useState('mark_inactive');
  const [destinationUserId, setDestinationUserId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setReason(''); setOption('mark_inactive'); setDestinationUserId(''); setSelectedIds([]); setPreview(null);
    setLoadingPreview(true);
    atlas.functions.invoke('deactivateUserWithTransfer', { target_user_id: user.id, preview: true })
      .then((res) => setPreview(res?.data || null))
      .catch((e) => toast({ title: 'Failed to load record counts', description: e.message, variant: 'destructive' }))
      .finally(() => setLoadingPreview(false));
  }, [open, user]);

  const activeUsers = users.filter((u) => isUserActive(u) && u.id !== user?.id);
  const totalRecords = preview?.total_owned_records ?? 0;

  const handleConfirm = async () => {
    if (!reason.trim()) { toast({ title: 'A deactivation reason is required.', variant: 'destructive' }); return; }
    if (option !== 'mark_inactive' && !destinationUserId) { toast({ title: 'Select a destination active user.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await atlas.functions.invoke('deactivateUserWithTransfer', {
        target_user_id: user.id,
        reason,
        transfer_option: option,
        destination_user_id: option === 'mark_inactive' ? null : destinationUserId,
        record_ids: option === 'transfer_selected' ? selectedIds : null
      });
      const data = res?.data;
      if (data?.error) throw new Error(data.error);
      const status = data?.status || (data?.transfers_failed ? 'partial' : 'completed');
      let title = 'Account deactivated';
      let description = `${data?.transfers_succeeded || 0} record(s) transferred, ${totalRecords - (data?.transfers_succeeded || 0) - (data?.transfers_failed || 0)} marked inactive-owner.`;
      let variant = 'default';
      if (status === 'reconciliation_required') {
        title = 'Deactivation completed — reconciliation required';
        description = `${data?.transfers_succeeded || 0} transferred, ${data?.reconciliation_required || 0} need manual reconciliation.`;
        variant = 'destructive';
      } else if (status === 'partial') {
        title = `Deactivated with ${data.transfers_failed} transfer failure(s)`;
        variant = 'destructive';
      }
      toast({ title, description, variant });
      onOpenChange(false);
      if (onDone) onDone();
    } catch (e) {
      toast({ title: 'Deactivation failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deactivate — {user ? displayName(user) : ''}</DialogTitle>
          <DialogDescription>
            The account is preserved with full history. No records are deleted. Owned records can be transferred to an active user or marked inactive-owner.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
                <AlertTriangle className="w-4 h-4" /> Records owned by this user
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <div key={key} className="rounded bg-white border border-amber-100 p-2 text-center">
                    <p className="font-bold text-amber-800">{preview?.counts?.[key] ?? 0}</p>
                    <p className="text-amber-600">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-amber-700 mt-2">Total: {totalRecords} record(s). Final Super Administrator protection is enforced.</p>
            </div>

            <div className="space-y-2">
              <Label>Transfer Option</Label>
              <Select value={option} onValueChange={setOption}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mark_inactive">Deactivate & mark records inactive-owner</SelectItem>
                  <SelectItem value="transfer_all" disabled={totalRecords === 0}>Deactivate & transfer all records</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {option !== 'mark_inactive' && (
              <div className="space-y-2">
                <Label>Destination Active User</Label>
                <Select value={destinationUserId} onValueChange={setDestinationUserId}>
                  <SelectTrigger><SelectValue placeholder="Select an active user" /></SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{displayName(u)}{u.email ? ` · ${u.email}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Deactivation Reason <span className="text-red-500">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this account being deactivated?" rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving || loadingPreview} className="bg-amber-600 text-white">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Deactivate Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
