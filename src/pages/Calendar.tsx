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
  useAutoCalendarSync,
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
  const isCalendarEnabled = useGoogleServiceEnabled('calendar');
  const connectGoogle = useGoogleOAuthInitiate();
  
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
  
  // Enable auto-sync to keep data fresh
  useAutoCalendarSync(isCalendarEnabled, 5); // Sync every 5 minutes
  
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
  const mockEvents: CalendarEvent[] = [
    // Sample data
    {
      id: '1',
      title: 'Sales Team Meeting',
      start: new Date(2024, 2, 15, 10, 0),
      end: new Date(2024, 2, 15, 11, 0),
      category: 'meeting',
      description: 'Weekly sales team sync',
      attendees: ['john@company.com', 'sarah@company.com'],
      location: 'Conference Room A',
      priority: 'high',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '2',
      title: 'Follow up with ABC Corp',
      start: new Date(2024, 2, 16, 14, 0),
      end: new Date(2024, 2, 16, 14, 30),
      category: 'follow-up',
      description: 'Follow up on proposal sent last week',
      companyId: 'company-1',
      priority: 'medium',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  
  // Process calendar events from database
  const events = useMemo(() => {
    console.log('Database events received:', dbEvents?.length || 0);
    
    // If Google Calendar is not enabled, show mock data
    if (!isCalendarEnabled) {
      console.log('Calendar not enabled, showing mock data');
      return mockEvents;
    }
    
    // If database events are available, use them (instant load)
    if (dbEvents && dbEvents.length > 0) {
      console.log('Using database events:', dbEvents.length);
      return dbEvents;
    }
    
    // If data is still loading from database, show empty array (no loading state needed)
    if (dbEventsLoading) {
      console.log('Loading events from database...');
      return [];
    }
    
    // If there's an error, show mock data
    if (dbError) {
      console.error('Database error, showing mock data:', dbError);
      return mockEvents;
    }
    
    // If no events in database and historical sync not completed, trigger it
    if (historicalSyncCompleted === false && !syncStatus?.isRunning) {
      console.log('Triggering historical sync...');
      syncCalendar.mutate({ action: 'sync-historical' });
      return [];
    }
    
    // Default to empty array if nothing else matches
    return [];
  }, [dbEvents, dbEventsLoading, dbError, isCalendarEnabled, historicalSyncCompleted, syncStatus, syncCalendar]);
  
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventEditor(true);
    setIsCreatingEvent(false);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent({
      id: '',
      title: '',
      start: date,
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
    setSelectedEvent({
      id: '',
      title: '',
      start: now,
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
      
      {/* Sync Status Indicator */}
      {integration && isCalendarEnabled && syncStatus && (
        <div className="bg-gray-800/50 border-b border-gray-700/50 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {syncStatus.isRunning ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-400">Syncing calendar...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400">
                    {syncStatus.lastSyncedAt
                      ? `Last synced ${formatDistanceToNow(syncStatus.lastSyncedAt, { addSuffix: true })}`
                      : 'Not synced yet'}
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
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => syncCalendar.mutate({ action: 'sync-incremental' })}
              disabled={syncStatus.isRunning || syncCalendar.isPending}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${syncStatus.isRunning || syncCalendar.isPending ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
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
            <CalendarQuickAdd onEventCreate={handleQuickAdd} />
          </div>
        </Card>

        {/* Calendar View */}
        <div className="flex-1 m-4 mt-0 overflow-hidden">
          <Card className="h-full">
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