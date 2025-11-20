import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { LeadList } from '@/components/leads/LeadList';
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel';
import { LeadPrepToolbar } from '@/components/leads/LeadPrepToolbar';
import { CSVUploadProgress } from '@/components/leads/CSVUploadProgress';
import { useLeadPrepRunner, useLeads, useLeadReprocessor } from '@/lib/hooks/useLeads';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { useActiveOrgId, useOrgStore } from '@/lib/stores/orgStore';
import logger from '@/lib/utils/logger';

export default function LeadsInbox() {
  const { data: leads = [], isLoading, isFetching, refetch } = useLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { mutateAsync: runPrep, isPending } = useLeadPrepRunner();
  const { mutateAsync: reprocessLead, isPending: isReprocessingLead } = useLeadReprocessor();
  const { userData: user } = useUser();
  const orgId = useActiveOrgId();
  const loadOrganizations = useOrgStore((state) => state.loadOrganizations);
  const isLoadingOrgs = useOrgStore((state) => state.isLoading);
  const orgError = useOrgStore((state) => state.error);
  const [isUploading, setIsUploading] = useState(false);
  const [reprocessingLeadId, setReprocessingLeadId] = useState<string | null>(null);
  const [orgLoadAttempted, setOrgLoadAttempted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'validating' | 'uploading' | 'processing' | 'complete' | 'error';
    progress: number;
    currentRow?: number;
    totalRows?: number;
    message?: string;
    stats?: {
      processed: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
    error?: string;
  } | null>(null);

  // Ensure organizations are loaded when user is available but orgId is not
  useEffect(() => {
    if (user?.id && !orgId && !isLoadingOrgs && !orgLoadAttempted && typeof loadOrganizations === 'function') {
      setOrgLoadAttempted(true);
      loadOrganizations().catch((error) => {
        logger.error('Failed to load organizations:', error);
        toast.error('Failed to load organizations. Please refresh the page.');
      });
    }
  }, [user?.id, orgId, isLoadingOrgs, orgLoadAttempted, loadOrganizations]);

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
    if (!user?.id) {
      toast.error('User information not available. Please sign in.');
      return;
    }

    // Wait for organization loading to complete if in progress
    if (isLoadingOrgs) {
      toast.info('Loading organization information...');
      // Wait up to 5 seconds for org loading
      let waited = 0;
      while (isLoadingOrgs && waited < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waited += 100;
      }
    }

    // Try to load organizations if orgId is not available
    let currentOrgId = orgId;
    if (!currentOrgId && typeof loadOrganizations === 'function') {
      try {
        await loadOrganizations();
        // Get the orgId from the store directly after loading
        const storeState = useOrgStore.getState();
        currentOrgId = storeState.activeOrgId;
        
        if (!currentOrgId && orgError) {
          logger.error('Organization loading error:', orgError);
          toast.error(`Failed to load organization: ${orgError}. Please check your database setup.`);
          return;
        }
      } catch (error: any) {
        logger.error('Failed to load organizations:', error);
        const errorMessage = error?.message || 'Unknown error';
        toast.error(`Failed to load organizations: ${errorMessage}. The organizations table may not exist.`);
        return;
      }
    }

    // If multi-tenant is disabled, orgId is optional - proceed with null
    const isMultiTenant = import.meta.env.VITE_MULTI_TENANT_ENABLED === 'true';
    
    if (!currentOrgId && isMultiTenant) {
      // Only require orgId if multi-tenant is enabled
      toast.error(
        'Organization not available. Please ensure you are part of an organization.',
        { duration: 15000 }
      );
      return;
    }
    
    // If multi-tenant is disabled, use null orgId (will be handled by edge function)
    if (!currentOrgId) {
      logger.log('Multi-tenant disabled, proceeding with null orgId');
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    
    // Check if this is a test (less than 100 rows) - do this before reading file
    const fileSize = file.size;
    const estimatedRows = Math.ceil(fileSize / 100); // Rough estimate: ~100 bytes per row
    
    // Initialize progress
    setUploadProgress({
      stage: 'validating',
      progress: 0,
      message: 'Reading CSV file...',
    });

    try {
      const text = await file.text();
      
      // Validate CSV has content
      if (!text || text.trim().length === 0) {
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: 'CSV file is empty',
        });
        setIsUploading(false);
        setTimeout(() => setUploadProgress(null), 3000);
        return;
      }
      
      // Parse CSV to get actual row count
      const lines = text.split('\n').filter(line => line.trim());
      const totalRows = Math.max(0, lines.length - 1); // Subtract header
      const isTestMode = totalRows <= 100;

      // Update progress
      setUploadProgress({
        stage: 'uploading',
        progress: 10,
        totalRows,
        message: isTestMode 
          ? `Found ${totalRows} rows (test mode) - Uploading to server...`
          : `Found ${totalRows} rows - Uploading to server...`,
      });

      // Update progress - processing stage
      setUploadProgress({
        stage: 'processing',
        progress: 30,
        totalRows,
        message: 'Processing bookings...',
      });

      // Call edge function (orgId is optional when multi-tenant is disabled)
      let data, error;
      try {
        // Simulate progress updates during processing
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (!prev || prev.stage !== 'processing') return prev;
            // Gradually increase progress from 30% to 90% while processing
            const newProgress = Math.min(90, prev.progress + 2);
            return {
              ...prev,
              progress: newProgress,
            };
          });
        }, 500);

        const result = await supabase.functions.invoke('import-savvycal-bookings', {
          body: {
            csvText: text,
            userId: user.id,
            orgId: currentOrgId || null, // Send null if not available (for single-tenant mode)
            testMode: isTestMode,
          },
        });
        
        clearInterval(progressInterval);
        data = result.data;
        error = result.error;
      } catch (invokeError: any) {
        logger.error('Edge function invocation failed:', invokeError);
        // Check if it's a network error or function not found
        const errorMessage = invokeError?.message || invokeError?.toString() || 'Unknown error';
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
          setUploadProgress({
            stage: 'error',
            progress: 0,
            error: 'Failed to connect to edge function. Please ensure the function is deployed and your network is connected.',
          });
          setTimeout(() => setUploadProgress(null), 5000);
          throw new Error(
            'Failed to connect to edge function. Please ensure:\n' +
            '1. The edge function is deployed: `supabase functions deploy import-savvycal-bookings`\n' +
            '2. Your Supabase project is running\n' +
            '3. You have network connectivity'
          );
        }
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: `Edge function error: ${errorMessage}`,
        });
        setTimeout(() => setUploadProgress(null), 5000);
        throw new Error(`Edge function error: ${errorMessage}`);
      }

      if (error) {
        logger.error('Edge function error:', error);
        const errorDetails = error.context?.error || error.message || 'Unknown error';
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: `Import service error: ${errorDetails}`,
        });
        setTimeout(() => setUploadProgress(null), 5000);
        throw new Error(`Import service error: ${errorDetails}`);
      }

      if (!data) {
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: 'No response from import service',
        });
        setTimeout(() => setUploadProgress(null), 5000);
        throw new Error('No response from import service');
      }

      if (data.success) {
        const report = data.report;
        const leadSummaryText = report
          ? `Import complete: ${report.leadsCreated || 0} new lead(s), ${report.leadsUpdated || 0} updated.`
          : 'Import completed successfully!';
        
        // Update progress to complete
        setUploadProgress({
          stage: 'complete',
          progress: 100,
          totalRows,
          currentRow: data.processed,
          message: leadSummaryText,
          stats: {
            processed: data.processed,
            created: data.created,
            updated: data.updated,
            skipped: data.skipped,
            errors: data.errors?.length || 0,
          },
        });

        const leadSummary = report
          ? ` Leads: ${report.leadsCreated || 0} new, ${report.leadsUpdated || 0} updated.`
          : '';
        const message = isTestMode
          ? `Test import complete: ${data.processed} processed, ${data.created} created, ${data.updated} updated. ${report?.unmappedLinkIds?.length || 0} unmapped link IDs.${leadSummary}`
          : `Import complete: ${data.processed} processed, ${data.created} created, ${data.updated} updated.${leadSummary}`;

        toast.success(message, {
          duration: 10000,
        });

        if (report?.unmappedLinkIds && report.unmappedLinkIds.length > 0) {
          toast.warning(
            `${report.unmappedLinkIds.length} link ID(s) need source mapping. Visit Admin > SavvyCal Sources to configure.`,
            { duration: 15000 }
          );
        }

        // Show errors if any
        if (data.errors && data.errors.length > 0) {
          logger.warn('Import completed with errors:', data.errors);
          toast.warning(
            `Import completed with ${data.errors.length} error(s). Check console for details.`,
            { duration: 8000 }
          );
        }

        // Refresh leads
        refetch();

        // Auto-close progress modal after 3 seconds
        setTimeout(() => {
          setUploadProgress(null);
        }, 3000);
      } else {
        const errorMessage = data.error || data.errors?.join(', ') || 'Import failed';
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: errorMessage,
        });
        setTimeout(() => setUploadProgress(null), 5000);
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      logger.error('Error uploading CSV:', error);
      const errorMessage = error?.message || error?.error || 'Failed to import CSV';
      
      // Update progress if not already set to error
      if (!uploadProgress || uploadProgress.stage !== 'error') {
        setUploadProgress({
          stage: 'error',
          progress: 0,
          error: errorMessage,
        });
        setTimeout(() => setUploadProgress(null), 5000);
      }
      
      toast.error(errorMessage, {
        duration: 10000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <CSVUploadProgress
        isOpen={!!uploadProgress}
        onClose={() => setUploadProgress(null)}
        stage={uploadProgress?.stage || 'validating'}
        progress={uploadProgress?.progress || 0}
        currentRow={uploadProgress?.currentRow}
        totalRows={uploadProgress?.totalRows}
        message={uploadProgress?.message}
        stats={uploadProgress?.stats}
        error={uploadProgress?.error}
      />
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
    </>
  );
}



