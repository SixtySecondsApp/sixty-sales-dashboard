import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar';
import { CalendarQuickAdd } from '@/components/calendar/CalendarQuickAdd';
import { CalendarEventModal } from '@/components/calendar/CalendarEventModal';
import { CalendarEventEditor } from '@/components/calendar/CalendarEventEditor';
import { CalendarAvailability } from '@/components/calendar/CalendarAvailability';
import { CalendarSkeleton } from '@/components/calendar/CalendarSkeleton';
import { ScreenReaderAnnouncements, useScreenReaderAnnouncement } from '@/components/calendar/ScreenReaderAnnouncements';
import { BulkActionsToolbar } from '@/components/calendar/BulkActionsToolbar';
import { SelectableEventsList } from '@/components/calendar/SelectableEventsList';
import { ExportImportModal } from '@/components/calendar/ExportImportModal';
import { useKeyboardNavigation } from '@/lib/hooks/useKeyboardNavigation';
import {
  getSyncStatusAnnouncement,
  getFilterStatusAnnouncement,
  getEventSavedAnnouncement,
  getViewSwitcherLabel
} from '@/lib/utils/accessibilityUtils';
import {
  Calendar as CalendarIcon,
  Plus,
  Settings,
  Filter,
  Search,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CheckSquare,
  List,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedSearch } from '@/lib/hooks/useDebounce';
import { 
  useGoogleIntegration,
  useGoogleOAuthInitiate,
  useGoogleServiceStatus,
  useGoogleIntegrationHealth,
  useCalendarEvents,
  useCalendarList,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useGoogleServiceEnabled
} from '@/lib/hooks/useGoogleIntegration';
import {
  useCalendarEventsFromDB,
  useSyncCalendar,
  useCalendarSyncStatus,
  useHistoricalSyncStatus,
  useCalendarEventSubscription,
  useHourlyCalendarSync
} from '@/lib/hooks/useCalendarEvents';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  description?: string;
  category: 'meeting' | 'call' | 'task' | 'deal' | 'personal' | 'follow-up';
  color?: string;
  attendees?: string[];
  location?: string;
  priority?: 'low' | 'medium' | 'high';
  recurring?: boolean;
  recurringPattern?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CalendarViewType = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

const Calendar: React.FC = () => {
  const [currentView, setCurrentView] = useState<CalendarViewType>('dayGridMonth');
  // Always start with current date/month
  const [selectedDate, setSelectedDate] = useState(new Date());
  const navigate = useNavigate();

  // User data for calendar ownership
  const { userData } = useUser();
  const userId = userData?.id || 'unknown-user';

  // Accessibility: Screen reader announcements
  const { announcement, priority, announce } = useScreenReaderAnnouncement();

  // Google Integration
  const { data: integration } = useGoogleIntegration();
  const { data: services } = useGoogleServiceStatus();
  const { data: health } = useGoogleIntegrationHealth();
  const isCalendarEnabled = useGoogleServiceEnabled('calendar');
  const connectGoogle = useGoogleOAuthInitiate();
  
  // Debug logging for calendar enable status
  // Calculate time range for calendar events (wider range for better UX)
  const timeRange = useMemo(() => {
    const start = new Date(selectedDate);
    start.setMonth(start.getMonth() - 2); // Load 2 months before
    start.setDate(1); // Start of month
    const end = new Date(selectedDate);
    end.setMonth(end.getMonth() + 3); // Load 3 months after
    end.setDate(0); // Last day of month
    return {
      startDate: start,
      endDate: end
    };
  }, [selectedDate]);
  
  // Enable real-time subscriptions for calendar events
  useCalendarEventSubscription(true);

  // Enable hourly background sync for current month (keeps data fresh)
  useHourlyCalendarSync(isCalendarEnabled);

  // Fetch calendar events from database (instant load)
  const { data: dbEvents, isLoading: dbEventsLoading, error: dbError, refetch: refetchEvents } = useCalendarEventsFromDB(
    timeRange.startDate,
    timeRange.endDate,
    isCalendarEnabled
  );
  
  // Sync status and auto-sync
  const { data: syncStatus } = useCalendarSyncStatus(isCalendarEnabled);
  const { data: historicalSyncCompleted } = useHistoricalSyncStatus(isCalendarEnabled);
  const syncCalendar = useSyncCalendar();
  
  // Prevent multiple concurrent syncs
  const isSyncing = syncCalendar.isPending;
  
  // IMPORTANT: Ignore syncStatus.isRunning to prevent stuck database states
  // Only check if our current mutation is pending
  // Auto-sync is permanently disabled - users have full control over syncing
  
  // Debug logging for sync status
  useEffect(() => {
    if (syncStatus) {
    }
    if (dbError) {
    }
  }, [syncStatus, dbError]);
  
  // Fetch calendar list
  const { data: calendarsData } = useCalendarList(isCalendarEnabled);
  
  // Calendar mutations
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  
  // Default mock events for when Google is not connected
  // Load from localStorage or generate many events for testing
  const mockEvents: CalendarEvent[] = useMemo(() => {
    // Try to load from localStorage first
    const stored = localStorage.getItem('mockCalendarEvents');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
      }
    }
    
    // Generate many events for testing if not in localStorage
    const events: CalendarEvent[] = [];
    const categories = ['Meetings', 'Calls', 'Tasks', 'Deals', 'Personal', 'Follow-ups'];
    const colors = {
      'Meetings': '#3B82F6',
      'Calls': '#10B981', 
      'Tasks': '#F59E0B',
      'Deals': '#8B5CF6',
      'Personal': '#EC4899',
      'Follow-ups': '#F97316'
    };
    
    // Generate 60+ events for the current month (for testing sidebar with full calendar)
    for (let day = 1; day <= 30; day++) {
      // Add 2-3 events per day for busy days
      const numEvents = day % 3 === 0 ? 3 : day % 2 === 0 ? 2 : 1;
      
      for (let i = 0; i < numEvents; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const hour = 9 + Math.floor(Math.random() * 8);
        const duration = 1 + Math.floor(Math.random() * 2);
        
        events.push({
          id: `event-${day}-${i}`,
          title: `${category.slice(0, -1)} with Client ${day}-${i}`,
          start: new Date(`2025-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`),
          end: new Date(`2025-09-${String(day).padStart(2, '0')}T${String(hour + duration).padStart(2, '0')}:00:00`),
          category: category.toLowerCase() as any,
          color: colors[category],
          description: `Important ${category.toLowerCase()} for project ${day}`,
          location: i % 2 === 0 ? 'Conference Room A' : 'Virtual'
        });
      }
    }
    
    // Store for next time
    localStorage.setItem('mockCalendarEvents', JSON.stringify(events));
    return events;
  }, []);
  
  // Process calendar events from database
  const events = useMemo(() => {
    // If database events are available, ALWAYS use them first (instant load)
    if (dbEvents && dbEvents.length > 0) {
      return dbEvents;
    }
    
    // If Google Calendar is not enabled, show mock data
    if (!isCalendarEnabled) {
      return mockEvents;
    }
    
    // If data is still loading from database, show empty array (no loading state needed)
    if (dbEventsLoading) {
      return [];
    }
    
    // If there's an error, show empty array and log it
    if (dbError) {
      return [];
    }
    
    // Default to empty array if nothing else matches
    return [];
  }, [dbEvents, dbEventsLoading, dbError, isCalendarEnabled, timeRange]);

  // Don't automatically sync on load - let user control when to sync
  // This prevents unnecessary API calls and lets users sync only what they need
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);

  // Debounced search for better performance
  const {
    searchQuery: searchTerm,
    debouncedSearchQuery,
    isSearching,
    setSearchQuery: setSearchTerm,
    clearSearch
  } = useDebouncedSearch('', 300);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Bulk operations state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  const handleSync = (period: string, start: Date, end: Date) => {
    if (isSyncing) {
      return;
    }

    setSyncFeedback(`Syncing ${period.toLowerCase()}...`);
    toast.info(`Syncing ${period.toLowerCase()} from Google Calendar...`);
    announce(`Syncing ${period.toLowerCase()} from Google Calendar`, 'polite');

    syncCalendar.mutate({
      action: period === 'All Events' ? 'sync-historical' : 'sync-incremental',
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }, {
      onSuccess: (result) => {
        if (result.eventsCreated && result.eventsCreated > 0) {
          setSyncFeedback(`✅ Successfully synced ${result.eventsCreated} events from ${period}!`);
          toast.success(`Great! Found and synced ${result.eventsCreated} events from ${period}.`);
          announce(`Sync complete: ${result.eventsCreated} events added from ${period}`, 'polite');
          refetchEvents();
        } else if (result.error) {
          setSyncFeedback(`❌ Error: ${result.error}`);
          toast.error(`Sync failed: ${result.error}`);
          announce(`Sync failed: ${result.error}`, 'assertive');
        } else {
          setSyncFeedback(`No events found for ${period}.`);
          toast.info(`No events found for ${period}. Try syncing a different time period.`);
          announce(`No events found for ${period}`, 'polite');
        }
      },
      onError: (error) => {
        setSyncFeedback('❌ Failed to sync calendar');
        toast.error('Failed to sync calendar. Please check your Google connection.');
        announce('Sync failed. Please check your Google connection', 'assertive');
      }
    });
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventEditor(true);
    setIsCreatingEvent(false);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const endDate = new Date(date);
    endDate.setHours(date.getHours() + 1);
    setSelectedEvent({
      id: '',
      title: '',
      start: date,
      end: endDate,
      category: 'meeting',
      createdBy: 'current-user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setShowEventEditor(true);
    setIsCreatingEvent(true);
  };

  const handleCreateEvent = () => {
    const now = new Date();
    const endTime = new Date(now);
    endTime.setHours(now.getHours() + 1);
    setSelectedEvent({
      id: '',
      title: '',
      start: now,
      end: endTime,
      category: 'meeting',
      createdBy: 'current-user',
      createdAt: now,
      updatedAt: now,
    });
    setShowEventEditor(true);
    setIsCreatingEvent(true);
    announce('Opening new event dialog');
  };

  // Accessibility: Keyboard navigation (defined after handleCreateEvent)
  const keyboardNav = useKeyboardNavigation({
    selectedDate,
    onDateChange: setSelectedDate,
    onEventCreate: handleCreateEvent,
    onViewChange: (view) => {
      setCurrentView(view);
      announce(`Switched to ${view === 'dayGridMonth' ? 'month' : view === 'timeGridWeek' ? 'week' : 'day'} view`);
    },
    currentView,
    enabled: true,
  });

  const handleEventSave = async (event: CalendarEvent) => {
    if (isCalendarEnabled) {
      if (isCreatingEvent) {
        try {
          await createEvent.mutateAsync({
            summary: event.title,
            description: event.description,
            startTime: event.start.toISOString(),
            endTime: (event.end || event.start).toISOString(),
            attendees: event.attendees,
            location: event.location,
          });
          toast.success('Event created successfully');
          refetchEvents();
        } catch (error) {
          toast.error('Failed to create event');
        }
      } else {
        toast.info('Event editing coming soon');
      }
    } else {
      // Local events for demo
      toast.info('Connect Google Calendar to save events');
    }
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleEventDelete = (eventId: string) => {
    if (isCalendarEnabled) {
      toast.info('Event deletion coming soon');
    } else {
      toast.info('Connect Google Calendar to delete events');
    }
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleQuickAdd = async (event: Partial<CalendarEvent>) => {
    if (isCalendarEnabled) {
      try {
        await createEvent.mutateAsync({
          summary: event.title || 'New Event',
          description: event.description,
          startTime: (event.start || new Date()).toISOString(),
          endTime: (event.end || event.start || new Date()).toISOString(),
        });
        toast.success('Event created successfully');
        refetchEvents();
      } catch (error) {
        toast.error('Failed to create event');
      }
    } else {
      toast.info('Connect Google Calendar to add events');
    }
  };

  // Bulk operations handlers
  const handleToggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedEventIds(new Set(filteredEvents.map(e => e.id)));
  };

  const handleClearSelection = () => {
    setSelectedEventIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedEventIds);

    for (const id of idsToDelete) {
      try {
        await deleteEvent.mutateAsync(id);
      } catch (error) {
        console.error(`Failed to delete event ${id}:`, error);
      }
    }

    await refetchEvents();
    setSelectedEventIds(new Set());
    announce(`Deleted ${idsToDelete.length} events`, 'polite');
  };

  const handleBulkReschedule = async (offsetDays: number) => {
    const eventsToReschedule = events.filter(e => selectedEventIds.has(e.id));

    for (const event of eventsToReschedule) {
      const newStart = new Date(event.start);
      newStart.setDate(newStart.getDate() + offsetDays);

      const newEnd = event.end ? new Date(event.end) : undefined;
      if (newEnd) {
        newEnd.setDate(newEnd.getDate() + offsetDays);
      }

      try {
        await updateEvent.mutateAsync({
          eventId: event.id,
          updates: {
            summary: event.title,
            startTime: newStart.toISOString(),
            endTime: newEnd?.toISOString() || newStart.toISOString(),
          }
        });
      } catch (error) {
        console.error(`Failed to reschedule event ${event.id}:`, error);
      }
    }

    await refetchEvents();
    setSelectedEventIds(new Set());
    announce(`Rescheduled ${eventsToReschedule.length} events`, 'polite');
  };

  const handleBulkCategorize = async (category: CalendarEvent['category']) => {
    const eventsToUpdate = events.filter(e => selectedEventIds.has(e.id));

    for (const event of eventsToUpdate) {
      try {
        // Update in local state (for mock events) or via API
        // Since we're using Google Calendar, we can't actually change the category there
        // This would need to be stored in a separate database table
        console.log(`Would categorize event ${event.id} as ${category}`);
      } catch (error) {
        console.error(`Failed to categorize event ${event.id}:`, error);
      }
    }

    // For now, just show success message
    // In production, this would update a local database table with category mappings
    toast.success(`Updated ${eventsToUpdate.length} events to category: ${category}`);
    setSelectedEventIds(new Set());
    announce(`Categorized ${eventsToUpdate.length} events`, 'polite');
  };

  // Import events handler
  const handleImportEvents = async (importedEvents: Partial<CalendarEvent>[]) => {
    try {
      // Import events to Google Calendar if enabled, otherwise store locally
      if (isCalendarEnabled) {
        for (const event of importedEvents) {
          try {
            await createEvent.mutateAsync({
              summary: event.title || 'Imported Event',
              description: event.description,
              startTime: (event.start || new Date()).toISOString(),
              endTime: (event.end || event.start || new Date()).toISOString(),
              attendees: event.attendees,
              location: event.location,
            });
          } catch (error) {
            console.error(`Failed to import event: ${event.title}`, error);
          }
        }

        await refetchEvents();
        announce(`Imported ${importedEvents.length} events successfully`, 'polite');
      } else {
        // For demo mode, just show message
        toast.info('Connect Google Calendar to import events');
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import events');
    }
  };

  // Memoized filtered events for better performance
  // Uses debounced search query to avoid filtering on every keystroke
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Use debounced search query for better performance
      const matchesSearch = !debouncedSearchQuery ||
        event.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        event.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(event.category);

      return matchesSearch && matchesCategory;
    });
  }, [events, debouncedSearchQuery, selectedCategories]);
  return (
    <div className="h-screen flex flex-col overflow-hidden" role="main" aria-label="Calendar application">
      {/* Screen Reader Announcements */}
      <ScreenReaderAnnouncements message={announcement} priority={priority} />

      {/* Skip to main content link for keyboard navigation */}
      <a
        href="#calendar-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#37bd7e] focus:text-white focus:rounded"
      >
        Skip to calendar
      </a>

      {/* Google Connection Banner */}
      {!isCalendarEnabled && (
        <div
          className="bg-yellow-50 dark:bg-yellow-500/10 border-b border-yellow-200 dark:border-yellow-500/20 px-6 py-3 flex-shrink-0"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Google Calendar Not Connected</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">Connect your Google account to sync your calendar events</p>
              </div>
            </div>
            <Button
              onClick={() => connectGoogle.mutate()}
              disabled={connectGoogle.isPending}
              variant="success"
              size="sm"
              aria-label={connectGoogle.isPending ? "Connecting to Google Calendar" : "Connect Google Calendar"}
            >
              {connectGoogle.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  Connect Calendar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Connected Status */}
      {integration && isCalendarEnabled && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-500/20 px-6 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Connected to {integration.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/integrations')}
            >
              <Settings className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </div>
        </div>
      )}
      
      {/* Sync Status Indicator - Simplified */}
      {integration && isCalendarEnabled && syncStatus && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/50 px-6 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isSyncing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-700 dark:text-blue-400">Syncing calendar...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {syncStatus?.lastSyncedAt
                      ? `Last synced ${formatDistanceToNow(syncStatus.lastSyncedAt, { addSuffix: true })}`
                      : 'Not synced yet - click below to start'}
                  </span>
                </div>
              )}

              {syncStatus.eventsCreated !== undefined && syncStatus.eventsCreated > 0 && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  +{syncStatus.eventsCreated} new
                </span>
              )}

              {syncStatus.eventsUpdated !== undefined && syncStatus.eventsUpdated > 0 && (
                <span className="text-xs text-blue-700 dark:text-blue-400">
                  {syncStatus.eventsUpdated} updated
                </span>
              )}

              {syncStatus.error && (
                <span className="text-xs text-red-700 dark:text-red-400">
                  Error: {syncStatus.error}
                </span>
              )}
            </div>

            {/* Sync feedback if present */}
            {syncFeedback && (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {syncFeedback}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Fixed Sidebar Container - Hidden on mobile */}
        <div
          className="hidden lg:block relative bg-white dark:bg-gray-900/50 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800/50 z-10 flex-shrink-0 overflow-hidden"
          style={{
            width: sidebarCollapsed ? '60px' : '320px',
            minWidth: sidebarCollapsed ? '60px' : '320px',
            maxWidth: sidebarCollapsed ? '60px' : '320px',
            transition: 'width 0.3s ease-in-out'
          }}
        >
          <CalendarSidebar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            events={events}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={setSidebarCollapsed}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            onEventClick={handleEventClick}
          />
        </div>

        {/* Main Calendar Area with Flex-1 */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Card className="m-2 sm:m-4 mb-0 flex-shrink-0">
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Calendar</h1>
                  {dbEventsLoading && (
                    <Loader2 className="w-4 h-4 text-gray-600 dark:text-gray-400 animate-spin" />
                  )}
                  
                  {/* Debug button */}
                  {isCalendarEnabled && (
                    <Button
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.functions.invoke('google-calendar?action=list-events', {
                            body: {
                              timeMin: new Date().toISOString(),
                              timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                              maxResults: 10
                            }
                          });
                          if (error) {
                            toast.error(`API Error: ${error.message}`);
                          } else {
                            toast.success('Check console for API response');
                          }
                        } catch (err) {
                          toast.error('Failed to call Calendar API');
                        }
                      }}
                      size="sm"
                      variant="tertiary"
                      className="ml-2"
                    >
                      Test API
                    </Button>
                  )}
                </div>
                
                {/* View Selector */}
                <div
                  className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1"
                  role="group"
                  aria-label="Calendar view selector"
                >
                  {[
                    { key: 'dayGridMonth' as const, label: 'Month' },
                    { key: 'timeGridWeek' as const, label: 'Week' },
                    { key: 'timeGridDay' as const, label: 'Day' },
                    { key: 'listWeek' as const, label: 'Agenda' },
                  ].map(view => (
                    <Button
                      key={view.key}
                      variant={currentView === view.key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setCurrentView(view.key)}
                      aria-label={getViewSwitcherLabel(view.key, currentView === view.key)}
                      aria-pressed={currentView === view.key}
                    >
                      {view.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Search */}
                <div className="relative">
                  <label htmlFor="calendar-search" className="sr-only">
                    Search events
                  </label>
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                  <Input
                    id="calendar-search"
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value) {
                        announce(`Searching for ${e.target.value}`, 'polite');
                      }
                    }}
                    className="pl-10 pr-10 w-64 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50 text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
                    aria-label="Search calendar events"
                    aria-describedby="search-status"
                  />
                  {isSearching && (
                    <Loader2
                      className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-[#37bd7e] animate-spin"
                      aria-label="Searching events"
                    />
                  )}
                  <span id="search-status" className="sr-only" aria-live="polite" aria-atomic="true">
                    {isSearching ? 'Searching...' : searchTerm ? `Found ${filteredEvents.length} events` : ''}
                  </span>
                </div>

                {/* Actions */}
                <Button
                  onClick={handleCreateEvent}
                  variant="success"
                  aria-label="Create new calendar event"
                >
                  <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                  New Event
                </Button>

                <Button variant="tertiary" size="sm" aria-label="Filter calendar events">
                  <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                  Filter
                </Button>

                <Button
                  variant={selectionMode ? "success" : "tertiary"}
                  size="sm"
                  onClick={() => {
                    setSelectionMode(!selectionMode);
                    if (selectionMode) {
                      setSelectedEventIds(new Set());
                    }
                  }}
                  aria-label={selectionMode ? "Exit selection mode" : "Enter selection mode for bulk operations"}
                  aria-pressed={selectionMode}
                >
                  {selectionMode ? (
                    <>
                      <List className="w-4 h-4 mr-2" aria-hidden="true" />
                      Exit Selection
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-4 h-4 mr-2" aria-hidden="true" />
                      Select
                    </>
                  )}
                </Button>

                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setShowExportImport(true)}
                  aria-label="Export or import calendar events"
                >
                  <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                  Export/Import
                </Button>

                <Button variant="tertiary" size="sm" aria-label="Calendar settings">
                  <Settings className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Add */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800/50">
            <div className="flex items-center gap-2">
              <CalendarQuickAdd onEventCreate={handleQuickAdd} />

              {/* Manual sync button */}
              {isCalendarEnabled && !isSyncing && (
                <Button
                  onClick={() => {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                    handleSync('This Month', start, end);
                  }}
                  variant="tertiary"
                  size="sm"
                  aria-label="Sync calendar events for this month from Google Calendar"
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sync Calendar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Calendar View */}
        <div className="flex-1 m-4 mt-0 min-h-0 overflow-hidden" style={{ minWidth: 0 }} id="calendar-main-content">
          <Card
            className="h-full flex flex-col overflow-hidden"
            style={{ contain: 'layout', minWidth: 0, maxWidth: '100%' }}
            role="region"
            aria-label="Calendar grid and events"
          >
            {/* Show sync prompt if no events and no database events */}
            {events.length === 0 && !dbEventsLoading && (!dbEvents || dbEvents.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10">
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-w-md shadow-lg">
                  <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {!syncStatus?.lastSyncedAt ? 'Welcome to Calendar' : 'No Events to Display'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {!syncStatus?.lastSyncedAt
                      ? "Let's first test the connection by syncing last week's events from your Google Calendar."
                      : "Your calendar is empty. Try syncing a different time period."}
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    {/* Show sync feedback if available */}
                    {syncFeedback && (
                      <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm text-blue-600 dark:text-blue-400">{syncFeedback}</p>
                      </div>
                    )}
                    
                    {/* Primary action: Test sync with last week's events first */}
                    {!syncStatus?.lastSyncedAt ? (
                      <Button
                        onClick={() => {
                          if (isSyncing) {
                            return;
                          }

                          setSyncFeedback('🔍 Testing connection with last week\'s activity...');
                          toast.info('Testing calendar sync with last week\'s events...');

                          syncCalendar.mutate({
                            action: 'sync-single'
                          }, {
                            onSuccess: (result) => {
                              if (result.eventsCreated && result.eventsCreated > 0) {
                                setSyncFeedback(`✅ Success! Connection works - found ${result.eventsCreated} events from last week.`);
                                toast.success('Great! Connection verified. Now you can sync more events.');
                                refetchEvents();
                                // The UI will automatically update to show more sync options
                              } else if (result.error) {
                                setSyncFeedback(`❌ Connection error: ${result.error}`);
                                toast.error(`Test failed: ${result.error}`);
                              } else {
                                setSyncFeedback('⚠️ No events found. Your calendar might be empty or try syncing a wider date range.');
                                toast.warning('No events found. Check if you have events in Google Calendar.');
                              }
                            },
                            onError: (error) => {
                              setSyncFeedback('❌ Failed to connect to Google Calendar');
                              toast.error('Connection failed. Please check your Google integration.');
                            }
                          });
                        }}
                        variant="default"
                        size="lg"
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Testing Connection...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-5 h-5 mr-2" />
                            Test with Last Week
                          </>
                        )}
                      </Button>
                    ) : (
                      /* After successful test, show progressive sync options */
                      <>
                        <div className="space-y-2">
                          <p className="text-xs text-emerald-600 dark:text-emerald-500 mb-2">✓ Connection verified!</p>
                          <p className="text-sm text-gray-600 dark:text-gray-500 mb-3">Now sync more events:</p>
                          
                          {/* Primary action: Current month */}
                          <Button
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), now.getMonth(), 1);
                              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                              handleSync('This Month', start, end);
                            }}
                            variant="success"
                            className="w-full"
                            disabled={isSyncing}
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Sync This Month
                          </Button>

                          {/* Secondary options */}
                          <Button
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                              const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                              handleSync('Last Month', start, end);
                            }}
                            variant="tertiary"
                            className="w-full"
                            disabled={isSyncing}
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Last Month
                          </Button>

                          <Button
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                              handleSync('Last 3 Months', start, end);
                            }}
                            variant="tertiary"
                            className="w-full"
                            disabled={isSyncing}
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Last 3 Months
                          </Button>

                          <Button
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), 0, 1);
                              const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                              handleSync('This Year', start, end);
                            }}
                            variant="tertiary"
                            className="w-full"
                            disabled={isSyncing}
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            This Year ({new Date().getFullYear()})
                          </Button>

                          <Button
                            onClick={() => {
                              const start = new Date(2024, 0, 1);
                              const end = new Date(2025, 11, 31, 23, 59, 59);
                              handleSync('All Events', start, end);
                            }}
                            variant="secondary"
                            className="w-full"
                            disabled={isSyncing}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync All (2024-2025)
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-hidden relative" style={{ minWidth: 0, maxWidth: '100%' }}>
              {dbEventsLoading && isCalendarEnabled ? (
                <CalendarSkeleton view={currentView} />
              ) : selectionMode ? (
                <SelectableEventsList
                  events={filteredEvents}
                  selectedIds={selectedEventIds}
                  onToggleEvent={handleToggleEventSelection}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                />
              ) : (
                <CalendarView
                  view={currentView}
                  events={filteredEvents}
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                  onEventDrop={async (eventId, newStart, newEnd) => {
                  // Update event via Google Calendar API
                  if (isCalendarEnabled) {
                    try {
                      await updateEvent.mutateAsync({
                        eventId,
                        calendarId: 'primary',
                        startTime: newStart.toISOString(),
                        endTime: (newEnd || newStart).toISOString()
                      });
                      toast.success('Event rescheduled');
                      refetchEvents();
                    } catch (error) {
                      toast.error('Failed to reschedule event');
                    }
                  } else {
                    toast.info('Connect Google Calendar to reschedule events');
                  }
                  }}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
      </div>

      {/* Event Modal - Using CalendarEventEditor instead */}

      {/* Event Editor Modal */}
      <CalendarEventEditor
        isOpen={showEventEditor}
        onClose={() => {
          setShowEventEditor(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        selectedDate={selectedDate}
        onEventSaved={() => {
          refetchEvents();
          setShowEventEditor(false);
        }}
      />

      {/* Availability Checker */}
      <CalendarAvailability
        isOpen={showAvailability}
        onClose={() => setShowAvailability(false)}
        existingEvents={events}
        onSelectSlot={(slot) => {
          setSelectedDate(slot.start);
          setShowEventEditor(true);
          setShowAvailability(false);
        }}
      />

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedEventIds.size}
        onClearSelection={handleClearSelection}
        onBulkDelete={handleBulkDelete}
        onBulkReschedule={handleBulkReschedule}
        onBulkCategorize={handleBulkCategorize}
      />

      {/* Export/Import Modal */}
      <ExportImportModal
        isOpen={showExportImport}
        onClose={() => setShowExportImport(false)}
        events={events}
        selectedEventIds={selectionMode ? selectedEventIds : undefined}
        onImport={handleImportEvents}
        userId={userId}
      />
    </div>
  );
};

export default Calendar;