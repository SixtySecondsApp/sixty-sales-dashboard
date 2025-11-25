import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LeadWithPrep } from '@/lib/services/leadService';
import { toast } from 'sonner';
import { LeadList } from '@/components/leads/LeadList';
import { LeadTable } from '@/components/leads/LeadTable';
import { LeadDetailPanel } from '@/components/leads/LeadDetailPanel';
import { LeadDetailModal } from '@/components/leads/LeadDetailModal';
import { LeadPrepToolbar } from '@/components/leads/LeadPrepToolbar';
import { LeadPagination } from '@/components/leads/LeadPagination';
import { CSVUploadProgress } from '@/components/leads/CSVUploadProgress';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLeadPrepRunner, useLeads, useLeadReprocessor } from '@/lib/hooks/useLeads';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { useActiveOrgId, useOrgStore } from '@/lib/stores/orgStore';
import logger from '@/lib/utils/logger';

export default function LeadsInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  // View mode and pagination state from URL params
  const viewMode = (searchParams.get('view') || 'list') as 'list' | 'table';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20;

  // Lazy loading state for list view
  const [visibleCount, setVisibleCount] = useState(20);
  const BATCH_SIZE = 20;

  // Filter and sort state (shared between list and table views)
  const [filterType, setFilterType] = useState<'all' | 'meeting_date' | 'booked_date'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSearchOpen) return;
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [isSearchOpen]);

  // Filter and sort leads (shared logic for both views)
  const filteredAndSortedLeads = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const matchesQuery = (lead: LeadWithPrep) => {
      if (!normalizedQuery) return true;

      const owner = lead.owner as { first_name: string | null; last_name: string | null; email: string | null } | null;
      const source = lead.source as { name: string | null; source_key: string | null } | null;
      const contact = lead.contact as {
        title: string | null;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;

      const values = [
        lead.contact_name,
        lead.contact_email,
        lead.domain,
        lead.meeting_title,
        lead.booking_link_name,
        lead.utm_source,
        lead.external_source,
        source?.name,
        source?.source_key,
        owner?.first_name,
        owner?.last_name,
        owner?.email,
        contact?.title,
        contact?.first_name,
        contact?.last_name,
        contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '',
      ];

      return values.some((value) => typeof value === 'string' && value.toLowerCase().includes(normalizedQuery));
    };

    const filtered = normalizedQuery ? leads.filter(matchesQuery) : [...leads];

    const getBookedDate = (lead: LeadWithPrep) =>
      lead.first_seen_at || lead.external_occured_at || lead.created_at || null;

    if (filterType === 'meeting_date') {
      return filtered.sort((a, b) => {
        const aDate = a.meeting_start ? new Date(a.meeting_start).getTime() : 0;
        const bDate = b.meeting_start ? new Date(b.meeting_start).getTime() : 0;
        return bDate - aDate; // Most recent first
      });
    }

    if (filterType === 'booked_date') {
      return filtered.sort((a, b) => {
        const aDate = getBookedDate(a) ? new Date(getBookedDate(a) as string).getTime() : 0;
        const bDate = getBookedDate(b) ? new Date(getBookedDate(b) as string).getTime() : 0;
        return bDate - aDate; // Most recent first
      });
    }

    // Default: sort by booked date
    return filtered.sort((a, b) => {
      const aDate = getBookedDate(a) ? new Date(getBookedDate(a) as string).getTime() : 0;
      const bDate = getBookedDate(b) ? new Date(getBookedDate(b) as string).getTime() : 0;
      return bDate - aDate;
    });
  }, [leads, filterType, searchQuery]);
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

  // Handle view mode change
  const handleViewModeChange = (view: 'list' | 'table') => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', view);
      // Reset to page 1 when switching views
      newParams.set('page', '1');
      return newParams;
    });
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set('page', page.toString());
      return newParams;
    });
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate pagination on filtered/sorted leads
  const totalPages = Math.ceil(filteredAndSortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedLeads.slice(start, end);
  }, [filteredAndSortedLeads, currentPage, pageSize]);

  // Lazy loaded leads for list view
  const lazyLoadedLeads = useMemo(() => {
    return filteredAndSortedLeads.slice(0, visibleCount);
  }, [filteredAndSortedLeads, visibleCount]);

  const hasMoreLeads = visibleCount < filteredAndSortedLeads.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredAndSortedLeads.length));
  }, [filteredAndSortedLeads.length, BATCH_SIZE]);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      handlePageChange(1);
    }
  }, [currentPage, totalPages]);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    if (currentPage !== 1 && (filterType || searchQuery)) {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('page', '1');
        return newParams;
      });
    }
  }, [filterType, searchQuery, currentPage, setSearchParams]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId]
  );

  // Auto-select first lead on page load or when current selection is not in filtered list
  // Only auto-select in list view - in table view, user must explicitly click to open modal
  useEffect(() => {
    // Skip auto-selection in table view to allow modal to close properly
    if (viewMode === 'table') {
      return;
    }

    if (filteredAndSortedLeads.length === 0) {
      // No leads, clear selection
      if (selectedLeadId !== null) {
        setSelectedLeadId(null);
      }
      return;
    }

    // Check if currently selected lead is in the filtered list
    const isSelectedInList = filteredAndSortedLeads.some(lead => lead.id === selectedLeadId);

    // Auto-select first lead if:
    // 1. No lead is selected, OR
    // 2. Selected lead is not in the current filtered list
    if (!selectedLeadId || !isSelectedInList) {
      setSelectedLeadId(filteredAndSortedLeads[0].id);
    }
  }, [filteredAndSortedLeads, selectedLeadId, viewMode]);

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
      <LeadDetailModal
        isOpen={viewMode === 'table' && !!selectedLead}
        onClose={() => setSelectedLeadId(null)}
        lead={selectedLead}
      />
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="flex h-[calc(100vh-160px)] sm:h-[calc(100vh-140px)] lg:h-[calc(100vh-120px)] flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40 overflow-hidden">
          <LeadPrepToolbar
            isProcessing={isPending || isFetching}
            onGenerate={handleGeneratePrep}
            onRefresh={() => refetch()}
            onUpload={handleUploadCSV}
            isUploading={isUploading}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        {viewMode === 'table' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Filter/Search Toolbar for Table View */}
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  Sort by:
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen((prev) => !prev)}
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-md border text-gray-500 transition-colors',
                      isSearchOpen
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-300'
                    )}
                    aria-label={isSearchOpen ? 'Close lead search' : 'Search leads'}
                    aria-pressed={isSearchOpen}
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilterType('all')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                      filterType === 'all'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('meeting_date')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                      filterType === 'meeting_date'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                  >
                    Meeting Date
                  </button>
                  <button
                    onClick={() => setFilterType('booked_date')}
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                      filterType === 'booked_date'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    )}
                  >
                    Booked Date
                  </button>
                </div>
              </div>
              <div className="ml-auto flex items-center">
                <div
                  className={cn(
                    'flex h-8 items-center overflow-hidden rounded-md border transition-all duration-300 ease-out',
                    isSearchOpen
                      ? 'w-48 sm:w-60 border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-gray-900'
                      : 'pointer-events-none w-0 border-transparent px-0 opacity-0'
                  )}
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search leads..."
                    className="h-full w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LeadTable
                leads={paginatedLeads}
                selectedLeadId={selectedLeadId}
                onSelect={(id) => setSelectedLeadId(id)}
                isLoading={isLoading}
                onReprocessLead={handleReprocessLead}
                reprocessingLeadId={reprocessingLeadId}
                isReprocessing={isReprocessingLead}
              />
            </div>
            <LeadPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAndSortedLeads.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-800 overflow-hidden">
            {/* Lead List - Full width on mobile, wider sidebar on desktop */}
            <div className="w-full lg:w-[32rem] lg:max-w-[32rem] flex-shrink-0 flex flex-col h-64 lg:h-auto">
              <div className="flex-1 overflow-y-auto min-h-0">
                <LeadList
                  leads={lazyLoadedLeads}
                  selectedLeadId={selectedLead?.id ?? null}
                  onSelect={(id) => setSelectedLeadId(id)}
                  isLoading={isLoading}
                  onReprocessLead={handleReprocessLead}
                  reprocessingLeadId={reprocessingLeadId}
                  isReprocessing={isReprocessingLead}
                  filterType={filterType}
                  onFilterTypeChange={setFilterType}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  onLoadMore={handleLoadMore}
                  hasMore={hasMoreLeads}
                  isLoadingMore={false}
                />
              </div>
            </div>
            {/* Lead Detail - Full width on mobile, flex-1 on desktop */}
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950/60 min-h-0">
              <LeadDetailPanel lead={selectedLead} />
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}



