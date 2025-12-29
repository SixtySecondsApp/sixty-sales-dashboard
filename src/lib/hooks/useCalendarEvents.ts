import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarService, CalendarSyncStatus } from '@/lib/services/calendarService';
import { CalendarEvent } from '@/pages/Calendar';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

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
      action?: 'sync-full' | 'sync-incremental' | 'sync-historical' | 'sync-single';
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
 * Only polls frequently when a sync is actively running
 */
export function useCalendarSyncStatus(enabled = true) {
  return useQuery({
    queryKey: CALENDAR_DB_QUERY_KEYS.syncStatus,
    queryFn: () => calendarService.getSyncStatus(),
    enabled,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    // Only poll when sync is actually in progress, otherwise rely on cache
    refetchInterval: (query) => {
      const status = query.state.data as CalendarSyncStatus | undefined;
      // Poll every 5s during active sync, otherwise stop polling
      return status?.status === 'syncing' ? 5000 : false;
    },
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
 * Hook to enable hourly background sync for current month
 * Syncs calendar events every hour to keep database fresh
 */
export function useHourlyCalendarSync(enabled = true) {
  const syncCalendar = useSyncCalendar();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Clear interval if disabled
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Sync current month every hour
    const syncCurrentMonth = () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      console.log('[HOURLY-SYNC] Syncing current month:', {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString()
      });

      syncCalendar.mutate({
        action: 'sync-incremental',
        calendarId: 'primary',
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString()
      });
    };

    // Initial sync on mount
    syncCurrentMonth();

    // Set up hourly interval (3600000 ms = 1 hour)
    syncIntervalRef.current = setInterval(syncCurrentMonth, 3600000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [enabled, syncCalendar.mutate]);

  return { isSyncing: syncCalendar.isPending };
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
      queryClient.invalidateQueries({ queryKey: ['calendar', 'db', 'events'] });
    },
  });
}

/**
 * Hook to subscribe to real-time calendar event changes
 * This allows for real-time updates when events are modified
 *
 * PERFORMANCE: Filters by user_id to only receive events for the current user
 * instead of listening to all calendar events across all users.
 */
export function useCalendarEventSubscription(
  enabled = true,
  onEventUpdate?: (event: CalendarEvent) => void
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    // Don't subscribe if disabled or no user
    if (!enabled || !user?.id) return;

    const subscription = supabase
      .channel(`calendar-events-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `user_id=eq.${user.id}`, // Only listen to current user's events
        },
        (payload) => {
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
  }, [enabled, user?.id, queryClient, onEventUpdate]);
}