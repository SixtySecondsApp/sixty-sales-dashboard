import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, 
  Search, 
  Plus, 
  Filter,
  Download,
  CheckSquare,
  Square,
  X,
  Trash2,
  TrendingUp,
  Award,
  Clock,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import MeetingCard from '@/components/MeetingCard';
import ViewModeToggle from '@/components/ViewModeToggle';
import { OwnerFilterV3 } from '@/components/OwnerFilterV3';
import { ProposalWizard } from '@/components/proposals/ProposalWizard';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { isUserAdmin } from '@/lib/utils/adminUtils';
import { useDebouncedSearch, filterItems } from '@/lib/hooks/useDebounce';
import { format } from 'date-fns';

interface Meeting {
  id: string;
  fathom_recording_id: string;
  title: string;
  share_url: string;
  calls_url: string;
  meeting_start: string;
  meeting_end: string;
  duration_minutes: number;
  owner_user_id: string;
  owner_email: string;
  team_name: string;
  company_id: string | null;
  primary_contact_id: string | null;
  summary: string;
  transcript_doc_url: string | null;
  sentiment_score: number | null;
  coach_rating: number | null;
  talk_time_rep_pct: number | null;
  talk_time_customer_pct: number | null;
  talk_time_judgement: string | null;
  company?: {
    name: string;
    domain: string;
  };
  action_items?: {
    completed: boolean;
  }[];
}

type SortField = 'title' | 'meeting_start' | 'duration_minutes' | 'sentiment_score' | 'coach_rating' | 'company';
type SortDirection = 'asc' | 'desc';

interface MeetingsViewProps {
  className?: string;
  showControls?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function MeetingsView({ 
  className, 
  showControls = true,
  viewMode: externalViewMode,
  onViewModeChange: externalOnViewModeChange
}: MeetingsViewProps) {
  const navigate = useNavigate();
  const { userData, isLoading: isUserLoading } = useUser();
  
  // State management
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { searchQuery, debouncedSearchQuery, isSearching, setSearchQuery } = useDebouncedSearch('', 400);
  const [internalViewMode, setInternalViewMode] = useState<'grid' | 'list'>('grid');
  
  // Use external viewMode if provided, otherwise use internal
  const viewMode = externalViewMode || internalViewMode;
  const setViewMode = externalOnViewModeChange || setInternalViewMode;
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [showProposalWizard, setShowProposalWizard] = useState(false);
  // Initialize with undefined to let OwnerFilterV3 set default to "My Items"
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>('meeting_start');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Multi-select functionality
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isSelectModeActive, setIsSelectModeActive] = useState(false);
  
  // Deletion state
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);


  // Fetch meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const { data: { user } } = await supabase.auth.getUser();
        // First, let's check if there are ANY meetings in the table
        const { data: allMeetings, error: allError } = await supabase
          .from('meetings')
          .select('id, title, owner_user_id')
          .limit(5);
        let query = supabase
          .from('meetings')
          .select(`
            *,
            company:companies!meetings_company_id_fkey(name, domain),
            action_items:meeting_action_items(completed)
          `)
          .order('meeting_start', { ascending: false });

        // Apply search filter
        if (searchQuery && searchQuery.trim()) {
          const searchPattern = `%${searchQuery.trim()}%`;
          query = query.or(`title.ilike.${searchPattern},summary.ilike.${searchPattern}`);
        }

        // Apply owner filter
        if (selectedOwnerId) {
          query = query.eq('owner_user_id', selectedOwnerId);
        } else {
        }

        const { data: meetingsData, error: meetingsError } = await query;
        if (meetingsError) {
          logger.error('❌ Meetings query failed:', meetingsError);
          // Don't throw error, just log it and show empty state
          setMeetings([]);
        } else {
          setMeetings(meetingsData || []);
        }
        
        setIsLoading(false);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch meetings');
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [searchQuery, selectedOwnerId]);

  // Multi-select handlers
  const handleSelectMeeting = (meetingId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedMeetings);
    if (isSelected) {
      newSelected.add(meetingId);
    } else {
      newSelected.delete(meetingId);
    }
    setSelectedMeetings(newSelected);
  };

  const handleSelectAll = (isSelected: boolean, filteredMeetings: Meeting[]) => {
    if (isSelected) {
      const allIds = new Set(filteredMeetings.map(meeting => meeting.id));
      setSelectedMeetings(allIds);
    } else {
      setSelectedMeetings(new Set());
    }
    setIsSelectAllChecked(isSelected);
  };

  const toggleSelectMode = () => {
    setIsSelectModeActive(!isSelectModeActive);
    if (isSelectModeActive) {
      setSelectedMeetings(new Set());
      setIsSelectAllChecked(false);
    }
  };

  // Delete meeting function
  const deleteMeeting = async (meetingId: string) => {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);
    
    if (error) throw error;
    
    // Update local state
    setMeetings(prev => prev.filter(m => m.id !== meetingId));
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = Array.from(selectedMeetings);
      
      if (selectedIds.length === 0) {
        toast.error('No meetings selected');
        return;
      }

      // Authorization check
      const isAdmin = isUserAdmin(userData);
      const authorizedMeetings = filteredAndSortedMeetings.filter(meeting => 
        selectedIds.includes(meeting.id) && (isAdmin || meeting.owner_user_id === userData?.id)
      );

      if (authorizedMeetings.length !== selectedIds.length) {
        const unauthorizedCount = selectedIds.length - authorizedMeetings.length;
        toast.error(`You do not have permission to delete ${unauthorizedCount} of the selected meetings`);
        
        if (authorizedMeetings.length === 0) {
          return;
        }
      }

      // Delete only authorized meetings
      const deletePromises = authorizedMeetings.map(meeting => deleteMeeting(meeting.id));
      await Promise.all(deletePromises);

      setSelectedMeetings(new Set());
      setIsSelectAllChecked(false);
      setBulkDeleteDialogOpen(false);
      
      toast.success(`Successfully deleted ${authorizedMeetings.length} meetings`);
    } catch (error) {
      toast.error('Failed to delete selected meetings');
    }
  };

  // Filter and sort meetings
  const filteredAndSortedMeetings = useMemo(() => {
    let filtered = meetings.filter(meeting => {
      const matchesSentiment = sentimentFilter === 'all' || 
        (sentimentFilter === 'positive' && meeting.sentiment_score && meeting.sentiment_score > 0.25) ||
        (sentimentFilter === 'neutral' && meeting.sentiment_score && meeting.sentiment_score >= -0.25 && meeting.sentiment_score <= 0.25) ||
        (sentimentFilter === 'negative' && meeting.sentiment_score && meeting.sentiment_score < -0.25);
      
      return matchesSentiment;
    });

    // Sort meetings
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special sorting cases
      if (sortField === 'company') {
        aValue = a.company?.name || '';
        bValue = b.company?.name || '';
      }

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // Convert to string for comparison if needed
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [meetings, sentimentFilter, sortField, sortDirection]);

  // Update select all checkbox state
  useEffect(() => {
    setIsSelectAllChecked(
      selectedMeetings.size > 0 && 
      selectedMeetings.size === filteredAndSortedMeetings.length && 
      filteredAndSortedMeetings.length > 0
    );
  }, [selectedMeetings.size, filteredAndSortedMeetings.length]);

  // Calculate stats
  const totalMeetings = filteredAndSortedMeetings.length;
  const avgDuration = totalMeetings > 0 
    ? Math.round(filteredAndSortedMeetings.reduce((sum, meeting) => sum + meeting.duration_minutes, 0) / totalMeetings)
    : 0;
  const avgSentiment = filteredAndSortedMeetings.filter(m => m.sentiment_score !== null).length > 0
    ? filteredAndSortedMeetings
        .filter(m => m.sentiment_score !== null)
        .reduce((sum, meeting) => sum + (meeting.sentiment_score || 0), 0) / filteredAndSortedMeetings.filter(m => m.sentiment_score !== null).length
    : 0;
  const avgCoachRating = filteredAndSortedMeetings.filter(m => m.coach_rating !== null).length > 0
    ? Math.round(filteredAndSortedMeetings
        .filter(m => m.coach_rating !== null)
        .reduce((sum, meeting) => sum + (meeting.coach_rating || 0), 0) / filteredAndSortedMeetings.filter(m => m.coach_rating !== null).length)
    : 0;

  const exportToCSV = () => {
    const csvContent = [
      ['Title', 'Company', 'Date', 'Duration', 'Sentiment', 'Coach Rating', 'Summary'].join(','),
      ...filteredAndSortedMeetings.map(meeting => [
        `"${meeting.title}"`,
        `"${meeting.company?.name || ''}"`,
        `"${format(new Date(meeting.meeting_start), 'yyyy-MM-dd')}"`,
        meeting.duration_minutes,
        meeting.sentiment_score || '',
        meeting.coach_rating || '',
        `"${meeting.summary?.substring(0, 100) || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `meetings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Meetings exported successfully');
  };

  // Navigation and action handlers
  const handleMeetingNavigate = (meeting: Meeting) => {
    navigate(`/meetings/${meeting.id}`);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    // Handle edit meeting
  };

  const handleDeleteMeeting = (meeting: Meeting) => {
    // Authorization check
    const isAdmin = isUserAdmin(userData);
    const isOwner = meeting.owner_user_id === userData?.id;
    
    if (!isAdmin && !isOwner) {
      toast.error('You do not have permission to delete this meeting');
      return;
    }
    
    setDeletingMeeting(meeting);
  };

  const confirmDelete = async () => {
    if (!deletingMeeting) return;
    
    try {
      await deleteMeeting(deletingMeeting.id);
      toast.success(`Meeting "${deletingMeeting.title}" deleted successfully`);
      setDeletingMeeting(null);
    } catch (error) {
      toast.error('Failed to delete meeting');
    }
  };

  const handleAddMeeting = () => {
    // Navigate to add meeting page when available
  };

  // Format sentiment for display
  const formatSentiment = (score: number) => {
    if (score > 0.25) return 'Positive';
    if (score < -0.25) return 'Negative';
    return 'Neutral';
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <div className="bg-gray-900/50 rounded-xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-800 rounded w-1/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="space-y-3 mt-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-800/50 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
          <h3 className="text-red-400 font-medium mb-2">Error loading meetings</h3>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >

      {/* Navigation and Controls */}
      {showControls && (
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-4 border border-gray-800/50 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Controls */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-10 pr-4 py-1.5 text-xs bg-gray-800/50 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200 w-64"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* View mode toggle */}
              <ViewModeToggle
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                variant="compact"
              />

              {/* Add button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddMeeting}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300"
              >
                <Plus className="w-4 h-4" />
                Add Meeting
              </motion.button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 pt-4 border-t border-gray-800/50">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <OwnerFilterV3
                defaultToCurrentUser={true}
                showQuickFilters={false}
                compact={true}
                selectedOwnerId={selectedOwnerId}
                onOwnerChange={setSelectedOwnerId}
                className="w-full sm:w-[180px]"
              />

              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] bg-gray-800/50 border-gray-700 text-white text-xs px-3 py-1.5">
                  <SelectValue placeholder="All Sentiments" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Challenging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                onClick={exportToCSV} 
                variant="outline" 
                size="sm"
                className="border-gray-600 bg-gray-800/50 text-gray-100 hover:bg-gray-700/70 hover:text-white hover:border-gray-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                onClick={() => setShowProposalWizard(true)}
                variant="outline" 
                size="sm"
                className="border-gray-600 bg-gray-800/50 text-gray-100 hover:bg-gray-700/70 hover:text-white hover:border-gray-500"
                disabled={isSelectModeActive && selectedMeetings.size === 0}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate Proposal
              </Button>
              <Button 
                onClick={toggleSelectMode}
                variant={isSelectModeActive ? "default" : "outline"}
                className={isSelectModeActive ? "bg-violet-600 hover:bg-violet-700 text-white" : ""} 
                size="sm"
              >
                {isSelectModeActive ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                {isSelectModeActive ? 'Exit Select' : 'Select Mode'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <AnimatePresence>
        {isSelectModeActive && selectedMeetings.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ 
              duration: 0.2,
              ease: [0.23, 1, 0.32, 1]
            }}
            className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-violet-600/10 backdrop-blur-xl border border-violet-500/20 rounded-xl p-4 shadow-2xl shadow-violet-500/10 mb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30">
                  <CheckSquare className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-medium text-white">
                  {selectedMeetings.size} selected
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setShowProposalWizard(true)}
                  variant="outline"
                  size="sm"
                  className="border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/50 text-blue-400 hover:text-blue-300"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Proposal from Selected
                </Button>
                <Button 
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
                <Button 
                  onClick={() => {
                    setSelectedMeetings(new Set());
                    setIsSelectAllChecked(false);
                  }}
                  variant="ghost" 
                  size="sm"
                  className="text-gray-400 hover:text-white hover:bg-gray-800/50"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' 
            : 'space-y-3'
          }
        >
          {filteredAndSortedMeetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              viewMode={viewMode}
              isSelected={selectedMeetings.has(meeting.id)}
              isSelectMode={isSelectModeActive}
              onSelect={handleSelectMeeting}
              onEdit={handleEditMeeting}
              onDelete={handleDeleteMeeting}
              onNavigate={handleMeetingNavigate}
            />
          ))}
          
          {filteredAndSortedMeetings.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No meetings found</h3>
              <p className="text-gray-500 text-sm">
                {searchQuery || sentimentFilter !== 'all' 
                  ? 'Try adjusting your search criteria or filters'
                  : 'Your meetings will appear here once they are recorded'
                }
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingMeeting} onOpenChange={() => setDeletingMeeting(null)}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Meeting</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <span className="font-semibold text-white">"{deletingMeeting?.title}"</span>? 
              This action cannot be undone and will also remove all associated action items and data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeletingMeeting(null)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Selected Meetings</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete <strong>{selectedMeetings.size}</strong> selected meetings? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {selectedMeetings.size} Meetings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proposal Wizard */}
      <ProposalWizard
        open={showProposalWizard}
        onOpenChange={setShowProposalWizard}
        meetingIds={isSelectModeActive && selectedMeetings.size > 0 
          ? Array.from(selectedMeetings) 
          : undefined}
        contactName={filteredAndSortedMeetings[0]?.company?.name || undefined}
        companyName={filteredAndSortedMeetings[0]?.company?.name || undefined}
      />
    </motion.div>
  );
}

export default MeetingsView;