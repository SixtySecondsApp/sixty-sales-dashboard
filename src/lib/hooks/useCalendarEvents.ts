import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService, CalendarSyncStatus } from '@/lib/services/calendarService';
import { CalendarEvent } from '@/pages/Calendar';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

// Query keys for calendar data
export const CALENDAR_DB_QUERY_KEYS = {
  events: (startDate: string, endDate: string) => ['calendar', 'db', 'events', startDate, endDate] as const,
  syncStatus: ['calendar', 'sync', 'status'] as const,
  historicalSyncStatus: ['calendar', 'sync', 'historical'] as const,
} as const;

/**
 * Hook to get calendar events from the database
 * This provides instant loading from the local database
 */
export function useCalendarEventsFromDB(
  startDate: Date,
  endDate: Date,
  enabled = true
) {
  return useQuery({
    queryKey: CALENDAR_DB_QUERY_KEYS.events(startDate.toISOString(), endDate.toISOString()),
    queryFn: () => calendarService.getEventsFromDB(startDate, endDate),
    enabled,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to sync calendar events from Google Calendar
 */
export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action = 'sync-incremental',
      calendarId = 'primary',
      startDate,
      endDate,
    }: {
      action?: 'sync-full' | 'sync-incremental' | 'sync-historical';
      calendarId?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      return calendarService.syncCalendarEvents(action, calendarId, startDate, endDate);
    },
    onSuccess: () => {
      // Invalidate calendar events cache to show new data
      queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
      queryClient.invalidateQueries({ queryKey: CALENDAR_DB_QUERY_KEYS.syncStatus });
    },
  });
}

/**
 * Hook to get calendar sync status
 */
export function useCalendarSyncStatus(enabled = true) {
  return useQuery({
    queryKey: CALENDAR_DB_QUERY_KEYS.syncStatus,
    queryFn: () => calendarService.getSyncStatus(),
    enabled,
    refetchInterval: 10000, // Refetch every 10 seconds when sync is running
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to check if historical sync has been completed
 */
export function useHistoricalSyncStatus(enabled = true) {
  return useQuery({
    queryKey: CALENDAR_DB_QUERY_KEYS.historicalSyncStatus,
    queryFn: () => calendarService.isHistoricalSyncCompleted(),
    enabled,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });
}

/**
 * Hook to auto-sync calendar events in the background
 * This runs periodically to keep the calendar data fresh
 */
export function useAutoCalendarSync(enabled = true, intervalMinutes = 5) {
  const syncCalendar = useSyncCalendar();
  const { data: syncStatus } = useCalendarSyncStatus(enabled);
  const { data: historicalSyncCompleted } = useHistoricalSyncStatus(enabled);

  useEffect(() => {
    if (!enabled) return;

    // Perform initial historical sync if not completed
    if (historicalSyncCompleted === false && !syncStatus?.isRunning) {
      console.log('Starting initial historical calendar sync...');
      syncCalendar.mutate({ action: 'sync-historical' });
      return;
    }

    // Set up periodic incremental sync
    const interval = setInterval(() => {
      if (!syncStatus?.isRunning) {
        console.log('Running periodic calendar sync...');
        syncCalendar.mutate({ action: 'sync-incremental' });
      }
    }, intervalMinutes * 60 * 1000);

    // Also sync when the tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !syncStatus?.isRunning) {
        const lastSync = syncStatus?.lastSyncedAt;
        if (!lastSync || new Date().getTime() - lastSync.getTime() > 5 * 60 * 1000) {
          console.log('Syncing calendar after tab became visible...');
          syncCalendar.mutate({ action: 'sync-incremental' });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMinutes, syncStatus?.isRunning, historicalSyncCompleted, syncCalendar]);
}

/**
 * Hook to link calendar event to a contact
 */
export function useLinkEventToContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, contactId }: { eventId: string; contactId: string }) =>
      calendarService.linkEventToContact(eventId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
    },
  });
}

/**
 * Hook to link calendar event to a deal
 */
export function useLinkEventToDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, dealId }: { eventId: string; dealId: string }) =>
      calendarService.linkEventToDeal(eventId, dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
    },
  });
}

/**
 * Hook to auto-link events to contacts
 */
export function useAutoLinkEventsToContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => calendarService.autoLinkEventsToContacts(),
    onSuccess: (linkedCount) => {
      console.log(`Auto-linked ${linkedCount} events to contacts`);
      queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
    },
  });
}

/**
 * Hook to subscribe to real-time calendar event changes
 * This allows for real-time updates when events are modified
 */
export function useCalendarEventSubscription(
  enabled = true,
  onEventUpdate?: (event: CalendarEvent) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const subscription = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
        },
        (payload) => {
          console.log('Calendar event changed:', payload);
          
          // Invalidate the calendar events cache
          queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
          
          // Call the callback if provided
          if (onEventUpdate && payload.new) {
            // Transform the database event to CalendarEvent format
            // This is a simplified transformation - you might need to adjust
            const event: CalendarEvent = {
              id: payload.new.external_id || payload.new.id,
              title: payload.new.title,
              start: new Date(payload.new.start_time),
              end: new Date(payload.new.end_time),
              allDay: payload.new.all_day,
              category: 'meeting',
              createdBy: payload.new.creator_email || 'unknown',
              createdAt: new Date(payload.new.created_at),
              updatedAt: new Date(payload.new.updated_at),
            };
            onEventUpdate(event);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, queryClient, onEventUpdate]);
}