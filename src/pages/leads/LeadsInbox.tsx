import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LeadList } from '@/components/leads/LeadList';
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel';
import { LeadPrepToolbar } from '@/components/leads/LeadPrepToolbar';
import { useLeadPrepRunner, useLeads } from '@/lib/hooks/useLeads';

export default function LeadsInbox() {
  const { data: leads = [], isLoading, isFetching, refetch } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { mutateAsync: runPrep, isPending } = useLeadPrepRunner();

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? leads[0] ?? null,
    [leads, selectedLeadId]
  );

  const handleGeneratePrep = async () => {
    try {
      const { processed } = await runPrep();
      toast.success(processed ? `Generated prep for ${processed} lead(s)` : 'No leads needed prep');
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to generate prep');
    }
  };

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40">
      <LeadPrepToolbar
        isProcessing={isPending || isFetching}
        onGenerate={handleGeneratePrep}
        onRefresh={() => refetch()}
      />
      <div className="flex flex-1 flex-col divide-y lg:flex-row lg:divide-x lg:divide-y-0">
        <div className="w-full max-w-xl shrink-0 overflow-y-auto">
          <LeadList
            leads={leads}
            selectedLeadId={selectedLead?.id ?? null}
            onSelect={(id) => setSelectedLeadId(id)}
            isLoading={isLoading}
          />
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950/60">
          <LeadDetailPanel lead={selectedLead} />
        </div>
      </div>
    </div>
  );
}

