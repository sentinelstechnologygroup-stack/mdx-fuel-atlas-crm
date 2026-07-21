import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { atlas } from '@/api/atlasClient';
import { useToast } from '@/components/ui/use-toast';

const STATUS_ICON = {
  unique_match: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  ambiguous: <AlertCircle className="w-4 h-4 text-amber-600" />,
  no_match: <XCircle className="w-4 h-4 text-slate-400" />
};
const STATUS_LABEL = {
  unique_match: 'Unique Match',
  ambiguous: 'Ambiguous',
  no_match: 'No Match'
};

// Administrator-only Ownership Migration Review. Lists existing records that
// have a legacy assigned email but no portable owner_user_id, proposes a safe
// (unique email) match, and lets the admin confirm — never auto-applies
// ambiguous matches.
export default function OwnershipMigrationReview() {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ownershipMigration'],
    queryFn: async () => {
      const res = await atlas.functions.invoke('ownershipMigrationReview', { action: 'list' });
      return res?.data;
    }
  });

  const proposals = data?.proposals || [];

  const handleConfirm = async (p) => {
    if (p.match_status !== 'unique_match') {
      toast({ title: 'Only unique matches can be confirmed directly.', variant: 'destructive' });
      return;
    }
    setConfirming(p.entity_id);
    const operationId = (crypto.randomUUID?.() || `migration-${Date.now()}`);
    try {
      const res = await atlas.functions.invoke('ownershipMigrationReview', {
        action: 'confirm',
        entity_type: p.entity_type,
        entity_id: p.entity_id,
        matched_user_id: p.proposed_user_id,
        legacy_email: p.legacy_assigned_email,
        force_admin_confirm: false,
        transfer_operation_id: operationId
      });
      const data = res?.data;
      if (data?.error) throw new Error(data.error);
      const status = data?.status || 'completed';
      if (status === 'already_processed') {
        toast({ title: 'Already processed', description: 'This migration was already completed earlier.' });
      } else if (status === 'reconciliation_required') {
        toast({ title: 'Reconciliation required', description: data.error || 'Ownership could not be restored automatically.', variant: 'destructive' });
      } else if (status === 'failed') {
        toast({ title: 'Migration failed', description: data.error || 'Ownership was restored.', variant: 'destructive' });
      } else {
        toast({ title: 'Ownership confirmed', description: `${p.entity_name} assigned to ${p.proposed_user_name}.` });
      }
      refetch();
    } catch (e) {
      toast({ title: 'Confirmation failed', description: e.message, variant: 'destructive' });
    } finally {
      setConfirming(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Ownership Migration Review</CardTitle>
        <CardDescription>
          Existing records with a legacy assigned email but no portable owner. Safe unique email matches can be confirmed individually. Ambiguous matches are never applied automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : proposals.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No unassigned records found. All existing records already have a portable owner or no legacy email to match.</p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Entity</TableHead>
                  <TableHead className="text-left">Record</TableHead>
                  <TableHead className="text-left">Legacy Email</TableHead>
                  <TableHead className="text-left">Proposed User</TableHead>
                  <TableHead className="text-left">Match</TableHead>
                  <TableHead className="text-left">Conflict</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => (
                  <TableRow key={`${p.entity_type}-${p.entity_id}`}>
                    <TableCell className="capitalize font-medium">{p.entity_type}</TableCell>
                    <TableCell className="truncate max-w-[160px]">{p.entity_name}</TableCell>
                    <TableCell className="text-xs">{p.legacy_assigned_email}</TableCell>
                    <TableCell>{p.proposed_user_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {STATUS_ICON[p.match_status]} {STATUS_LABEL[p.match_status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-amber-600">{p.conflict || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={p.match_status !== 'unique_match' || confirming === p.entity_id}
                        onClick={() => handleConfirm(p)}
                      >
                        {confirming === p.entity_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Assignment'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
