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
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <div className="flex h-full min-h-[calc(100vh-160px)] sm:min-h-[calc(100vh-140px)] lg:min-h-[calc(100vh-120px)] flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40 overflow-hidden">
        <LeadPrepToolbar
          isProcessing={isPending || isFetching}
          onGenerate={handleGeneratePrep}
          onRefresh={() => refetch()}
        />
        <div className="flex flex-1 flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">
          {/* Lead List - Full width on mobile, sidebar on desktop */}
          <div className="w-full lg:w-96 lg:max-w-xl flex-shrink-0 overflow-y-auto h-64 lg:h-auto">
            <LeadList
              leads={leads}
              selectedLeadId={selectedLead?.id ?? null}
              onSelect={(id) => setSelectedLeadId(id)}
              isLoading={isLoading}
            />
          </div>
          {/* Lead Detail - Full width on mobile, flex-1 on desktop */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950/60">
            <LeadDetailPanel lead={selectedLead} />
          </div>
        </div>
      </div>
    </div>
  );
}



