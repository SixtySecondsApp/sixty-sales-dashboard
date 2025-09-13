import React, { useState, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { CalendarView } from '@/components/calendar/CalendarView';
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar';
import { CalendarQuickAdd } from '@/components/calendar/CalendarQuickAdd';
import { CalendarEventModal } from '@/components/calendar/CalendarEventModal';
import { CalendarEventEditor } from '@/components/calendar/CalendarEventEditor';
import { CalendarAvailability } from '@/components/calendar/CalendarAvailability';
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
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  useHistoricalSyncStatus
} from '@/lib/hooks/useCalendarEvents';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';

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
  
  // Google Integration
  const { data: integration } = useGoogleIntegration();
  const { data: services } = useGoogleServiceStatus();
  const { data: health } = useGoogleIntegrationHealth();
  const isCalendarEnabled = useGoogleServiceEnabled('calendar');
  const connectGoogle = useGoogleOAuthInitiate();
  
  // Debug logging for calendar enable status
  console.log('[Calendar] Integration Debug:', {
    integration: !!integration,
    health: health?.isConnected,
    services,
    calendarService: services?.calendar,
    isCalendarEnabled,
    fullIntegration: integration,
    fullHealth: health
  });
  
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
      console.log('Calendar Sync Status:', {
        isRunning: syncStatus.isRunning,
        lastSyncedAt: syncStatus.lastSyncedAt,
        eventsCreated: syncStatus.eventsCreated,
        eventsUpdated: syncStatus.eventsUpdated,
        error: syncStatus.error
      });
    }
    if (dbError) {
      console.error('Database error:', dbError);
    }
  }, [syncStatus, dbError]);
  
  // Fetch calendar list
  const { data: calendarsData } = useCalendarList(isCalendarEnabled);
  
  // Calendar mutations
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  
  // Default mock events for when Google is not connected
  // No mock events - show empty state when no real data
  const mockEvents: CalendarEvent[] = [];
  
  // Process calendar events from database
  const events = useMemo(() => {
    console.log('[Calendar] Processing events:', {
      dbEventsCount: dbEvents?.length || 0,
      isLoading: dbEventsLoading,
      hasError: !!dbError,
      isEnabled: isCalendarEnabled,
      dateRange: timeRange
    });
    
    // If database events are available, ALWAYS use them first (instant load)
    if (dbEvents && dbEvents.length > 0) {
      console.log('[Calendar] Using database events:', dbEvents.length);
      console.log('[Calendar] Sample events:', dbEvents.slice(0, 3));
      return dbEvents;
    }
    
    // If Google Calendar is not enabled, show mock data
    if (!isCalendarEnabled) {
      console.log('[Calendar] Not enabled, showing mock data');
      return mockEvents;
    }
    
    // If data is still loading from database, show empty array (no loading state needed)
    if (dbEventsLoading) {
      console.log('[Calendar] Loading events from database...');
      return [];
    }
    
    // If there's an error, show empty array and log it
    if (dbError) {
      console.error('[Calendar] Database error:', dbError);
      return [];
    }
    
    // Default to empty array if nothing else matches
    console.log('[Calendar] No events available');
    return [];
  }, [dbEvents, dbEventsLoading, dbError, isCalendarEnabled, timeRange]);

  // Don't automatically sync on load - let user control when to sync
  // This prevents unnecessary API calls and lets users sync only what they need
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSync = (period: string, start: Date, end: Date) => {
    if (isSyncing) {
      console.log('[Calendar] Sync already in progress');
      return;
    }
    
    setSyncFeedback(`Syncing ${period.toLowerCase()}...`);
    toast.info(`Syncing ${period.toLowerCase()} from Google Calendar...`);
    
    syncCalendar.mutate({ 
      action: period === 'All Events' ? 'sync-historical' : 'sync-incremental',
      startDate: start.toISOString(),
      endDate: end.toISOString()
    }, {
      onSuccess: (result) => {
        console.log(`[Calendar] ${period} sync result:`, result);
        if (result.eventsCreated && result.eventsCreated > 0) {
          setSyncFeedback(`✅ Successfully synced ${result.eventsCreated} events from ${period}!`);
          toast.success(`Great! Found and synced ${result.eventsCreated} events from ${period}.`);
          refetchEvents();
        } else if (result.error) {
          setSyncFeedback(`❌ Error: ${result.error}`);
          toast.error(`Sync failed: ${result.error}`);
        } else {
          setSyncFeedback(`No events found for ${period}.`);
          toast.info(`No events found for ${period}. Try syncing a different time period.`);
        }
      },
      onError: (error) => {
        console.error('[Calendar] Sync error:', error);
        setSyncFeedback('❌ Failed to sync calendar');
        toast.error('Failed to sync calendar. Please check your Google connection.');
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
  };

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

  // Debug the filtering process
  console.log('Events before filtering:', events.length, events);
  console.log('Search term:', searchTerm);
  console.log('Selected categories:', selectedCategories);
  
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(event.category);
    return matchesSearch && matchesCategory;
  });
  
  console.log('Events after filtering:', filteredEvents.length, filteredEvents);

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      {/* Google Connection Banner */}
      {!isCalendarEnabled && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Google Calendar Not Connected</p>
                <p className="text-xs text-gray-400">Connect your Google account to sync your calendar events</p>
              </div>
            </div>
            <Button
              onClick={() => connectGoogle.mutate()}
              disabled={connectGoogle.isPending}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {connectGoogle.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect Calendar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Connected Status */}
      {integration && isCalendarEnabled && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-emerald-400">Connected to {integration.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/integrations')}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </div>
        </div>
      )}
      
      {/* Sync Status Indicator - Simplified */}
      {integration && isCalendarEnabled && syncStatus && (
        <div className="bg-gray-800/50 border-b border-gray-700/50 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isSyncing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-400">Syncing calendar...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400">
                    {syncStatus?.lastSyncedAt
                      ? `Last synced ${formatDistanceToNow(syncStatus.lastSyncedAt, { addSuffix: true })}`
                      : 'Not synced yet - click below to start'}
                  </span>
                </div>
              )}
              
              {syncStatus.eventsCreated !== undefined && syncStatus.eventsCreated > 0 && (
                <span className="text-xs text-emerald-400">
                  +{syncStatus.eventsCreated} new
                </span>
              )}
              
              {syncStatus.eventsUpdated !== undefined && syncStatus.eventsUpdated > 0 && (
                <span className="text-xs text-blue-400">
                  {syncStatus.eventsUpdated} updated
                </span>
              )}
              
              {syncStatus.error && (
                <span className="text-xs text-red-400">
                  Error: {syncStatus.error}
                </span>
              )}
            </div>
            
            {/* Sync feedback if present */}
            {syncFeedback && (
              <div className="text-sm text-gray-400">
                {syncFeedback}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {/* Sidebar */}
        <motion.div
        initial={{ width: sidebarCollapsed ? 60 : 320 }}
        animate={{ width: sidebarCollapsed ? 60 : 320 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="bg-gray-900/50 border-r border-gray-800/50 backdrop-blur-sm"
      >
        <CalendarSidebar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          events={events}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={setSidebarCollapsed}
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
        />
      </motion.div>

        {/* Main Calendar Area */}
        <div className="flex-1 flex flex-col">
        {/* Header */}
        <Card className="m-4 mb-0">
          <div className="p-4 border-b border-gray-800/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="w-6 h-6 text-emerald-400" />
                  <h1 className="text-xl font-semibold text-gray-100">Calendar</h1>
                  {dbEventsLoading && (
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  )}
                  
                  {/* Debug button */}
                  {isCalendarEnabled && (
                    <Button
                      onClick={async () => {
                        console.log('Testing Calendar API directly...');
                        try {
                          const { data, error } = await supabase.functions.invoke('google-calendar?action=list-events', {
                            body: {
                              timeMin: new Date().toISOString(),
                              timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                              maxResults: 10
                            }
                          });
                          console.log('Direct Calendar API response:', { data, error });
                          if (error) {
                            toast.error(`API Error: ${error.message}`);
                          } else {
                            toast.success('Check console for API response');
                          }
                        } catch (err) {
                          console.error('Direct API error:', err);
                          toast.error('Failed to call Calendar API');
                        }
                      }}
                      size="sm"
                      variant="outline"
                      className="ml-2"
                    >
                      Test API
                    </Button>
                  )}
                </div>
                
                {/* View Selector */}
                <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg p-1">
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
                      className={currentView === view.key ? 
                        'bg-emerald-600 text-white' : 
                        'text-gray-400 hover:text-gray-200'
                      }
                    >
                      {view.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-gray-800/50 border-gray-700/50 text-gray-200 placeholder-gray-400"
                  />
                </div>

                {/* Actions */}
                <Button
                  onClick={handleCreateEvent}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Event
                </Button>
                
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
                
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Add */}
          <div className="p-4 border-b border-gray-800/50">
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
                  variant="outline"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Calendar
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Calendar View */}
        <div className="flex-1 m-4 mt-0 overflow-hidden">
          <Card className="h-full">
            {/* Show sync prompt if no events and no database events */}
            {events.length === 0 && !dbEventsLoading && (!dbEvents || dbEvents.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
                <div className="text-center p-8 bg-gray-800 rounded-lg border border-gray-700 max-w-md">
                  <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">
                    {!syncStatus?.lastSyncedAt ? 'Welcome to Calendar' : 'No Events to Display'}
                  </h3>
                  <p className="text-gray-400 mb-6">
                    {!syncStatus?.lastSyncedAt 
                      ? "Let's first test the connection by syncing last week's events from your Google Calendar."
                      : "Your calendar is empty. Try syncing a different time period."}
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    {/* Show sync feedback if available */}
                    {syncFeedback && (
                      <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm text-blue-400">{syncFeedback}</p>
                      </div>
                    )}
                    
                    {/* Primary action: Test sync with last week's events first */}
                    {!syncStatus?.lastSyncedAt ? (
                      <Button
                        onClick={() => {
                          if (isSyncing) {
                            console.log('[Calendar] Sync already in progress');
                            return;
                          }
                          
                          setSyncFeedback('🔍 Testing connection with last week\'s activity...');
                          toast.info('Testing calendar sync with last week\'s events...');
                          
                          syncCalendar.mutate({ 
                            action: 'sync-single'
                          }, {
                            onSuccess: (result) => {
                              console.log('[Calendar] Test sync result:', result);
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
                              console.error('[Calendar] Test sync error:', error);
                              setSyncFeedback('❌ Failed to connect to Google Calendar');
                              toast.error('Connection failed. Please check your Google integration.');
                            }
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
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
                          <p className="text-xs text-emerald-500 mb-2">✓ Connection verified!</p>
                          <p className="text-sm text-gray-500 mb-3">Now sync more events:</p>
                          
                          {/* Primary action: Current month */}
                          <Button
                            onClick={() => {
                              const now = new Date();
                              const start = new Date(now.getFullYear(), now.getMonth(), 1);
                              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                              handleSync('This Month', start, end);
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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
                            variant="outline"
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
                            variant="outline"
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
                            variant="outline"
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
                            className="w-full bg-gray-700 hover:bg-gray-600"
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
    </div>
  );
};

export default Calendar;