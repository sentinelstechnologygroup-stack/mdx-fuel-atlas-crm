import React from 'react';
import { atlas } from '@/api/atlasClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import LeadForm from "@/components/crm/LeadForm";
import OwnershipBadge from "@/components/ownership/OwnershipBadge";
import OwnershipAssignControl from "@/components/ownership/OwnershipAssignControl";
import { usePermissions } from '@/components/hooks/usePermissions';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function LeadDetailsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const leadId = queryParams.get('id') || queryParams.get('leadId');
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      // Since .get(id) isn't explicitly documented in the prompt's examples but usually exists,
      // I'll use filter or list. But usually list() returns all.
      // Best practice from prompt: atlas.entities.Lead.list() and find, OR filter.
      // Actually, usually there is a .get(id). If not, I'll filter.
      // Let's try filter by ID which is safer if get isn't available.
      const leads = await atlas.entities.Lead.filter({ id: leadId });
      return leads[0];
    },
    enabled: !!leadId
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }) => atlas.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['lead', leadId]);
      queryClient.invalidateQueries(['leads']);
    }
  });

  const convertToOpportunity = useMutation({
    mutationFn: async (leadData) => {
      const response = await atlas.functions.invoke(
        'convertLeadToOpportunity',
        {
          leadId: leadData.id
        }
      );

      return response?.data ?? {};
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries(['opportunities']),
        queryClient.invalidateQueries(['leads']),
        queryClient.invalidateQueries(['lead', leadId])
      ]);

      alert(
        result.created
          ? 'Lead converted to an opportunity successfully.'
          : 'This lead is already connected to an opportunity.'
      );
    },
    onError: (error) => {
      console.error(
        'Lead conversion failed:',
        error
      );

      alert(
        'The lead could not be converted. ' +
        'No partial conversion was saved. ' +
        'Please retry or contact an administrator.'
      );
    }
  });

  const handleClose = () => {
    navigate(createPageUrl('Leads'));
  };

  React.useEffect(() => {
    if (!leadId) {
      navigate(createPageUrl('Leads'));
    }
  }, [leadId, navigate]);

  React.useEffect(() => {
    if (!isLoading && !lead && leadId) {
       navigate(createPageUrl('Leads'));
    }
  }, [lead, isLoading, leadId, navigate]);

  if (!leadId) return null;
  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;
  if (!lead) return null;

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl p-0 bg-transparent border-none">
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <div className="min-w-0 flex-1">
            <OwnershipBadge record={lead} showTeam showStatus size="lg" />
          </div>
          <div className="flex items-center gap-2">
            {canEdit && lead.lead_status === 'Qualified' && (
              <Button
                type="button"
                size="sm"
                disabled={convertToOpportunity.isPending}
                onClick={() => convertToOpportunity.mutate(lead)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {convertToOpportunity.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Convert to Opportunity
              </Button>
            )}
            <OwnershipAssignControl entityType="lead" record={lead} onUpdated={() => queryClient.invalidateQueries(['lead', leadId])} />
          </div>
        </div>
        <LeadForm
          lead={lead}
          onSaveAndClose={(data) => {
            updateLead.mutate({ id: lead.id, data });
            handleClose();
          }}
          onSaveAndStay={(data) => {
            updateLead.mutate({ id: lead.id, data });
          }}
          onCancel={handleClose}
          isSubmitting={updateLead.isPending || convertToOpportunity.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
