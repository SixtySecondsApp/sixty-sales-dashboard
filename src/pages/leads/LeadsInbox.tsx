import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LeadList } from '@/components/leads/LeadList';
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel';
import { LeadPrepToolbar } from '@/components/leads/LeadPrepToolbar';
import { useLeadPrepRunner, useLeads, useLeadReprocessor } from '@/lib/hooks/useLeads';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import logger from '@/lib/utils/logger';

export default function LeadsInbox() {
  const { data: leads = [], isLoading, isFetching, refetch } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { mutateAsync: runPrep, isPending } = useLeadPrepRunner();
  const { mutateAsync: reprocessLead, isPending: isReprocessingLead } = useLeadReprocessor();
  const { userData: user } = useUser();
  const [isUploading, setIsUploading] = useState(false);
  const [reprocessingLeadId, setReprocessingLeadId] = useState<string | null>(null);

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

  const handleReprocessLead = async (leadId: string) => {
    setReprocessingLeadId(leadId);
    try {
      await reprocessLead(leadId);
      toast.success('Lead queued for reprocessing');
      await refetch();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to reprocess lead');
    } finally {
      setReprocessingLeadId(null);
    }
  };

  const handleUploadCSV = async (file: File) => {
    if (!user?.id || !user?.org_id) {
      toast.error('User information not available');
      return;
    }

    setIsUploading(true);
    try {
      const text = await file.text();
      
      // Check if this is a test (less than 100 rows)
      const lines = text.split('\n').filter(line => line.trim());
      const isTestMode = lines.length <= 100;

      if (isTestMode) {
        toast.info('Running in test mode (<100 rows). Review results before full import.');
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('import-savvycal-bookings', {
        body: {
          csvText: text,
          userId: user.id,
          orgId: user.org_id,
          testMode: isTestMode,
        },
      });

      if (error) throw error;

      if (data.success) {
        const report = data.report;
        const message = isTestMode
          ? `Test import complete: ${data.processed} processed, ${data.created} created, ${data.updated} updated. ${report?.unmappedLinkIds?.length || 0} unmapped link IDs.`
          : `Import complete: ${data.processed} processed, ${data.created} created, ${data.updated} updated.`;

        toast.success(message, {
          duration: 10000,
        });

        if (report?.unmappedLinkIds && report.unmappedLinkIds.length > 0) {
          toast.warning(
            `${report.unmappedLinkIds.length} link ID(s) need source mapping. Visit Admin > SavvyCal Sources to configure.`,
            { duration: 15000 }
          );
        }

        // Refresh leads
        refetch();
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error: any) {
      logger.error('Error uploading CSV:', error);
      toast.error(error?.message || 'Failed to import CSV');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <div className="flex h-full min-h-[calc(100vh-160px)] sm:min-h-[calc(100vh-140px)] lg:min-h-[calc(100vh-120px)] flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40 overflow-hidden">
        <LeadPrepToolbar
          isProcessing={isPending || isFetching}
          onGenerate={handleGeneratePrep}
          onRefresh={() => refetch()}
          onUpload={handleUploadCSV}
          isUploading={isUploading}
        />
        <div className="flex flex-1 flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">
          {/* Lead List - Full width on mobile, wider sidebar on desktop */}
          <div className="w-full lg:w-[32rem] lg:max-w-[32rem] flex-shrink-0 overflow-y-auto h-64 lg:h-auto">
            <LeadList
              leads={leads}
              selectedLeadId={selectedLead?.id ?? null}
              onSelect={(id) => setSelectedLeadId(id)}
              isLoading={isLoading}
              onReprocessLead={handleReprocessLead}
              reprocessingLeadId={reprocessingLeadId}
              isReprocessing={isReprocessingLead}
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



