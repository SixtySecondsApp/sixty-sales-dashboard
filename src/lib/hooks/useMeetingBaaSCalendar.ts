/**
 * useMeetingBaaSCalendar Hook
 *
 * Manages the connection between user's Google Calendar and MeetingBaaS.
 * This enables automatic bot deployment for calendar events.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

export interface MeetingBaaSCalendar {
  id: string;
  user_id: string;
  org_id: string | null;
  meetingbaas_calendar_id: string;
  raw_calendar_id: string;
  platform: 'google' | 'microsoft';
  email: string | null;
  name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ConnectCalendarResponse {
  success: boolean;
  message?: string;
  error?: string;
  calendar?: {
    id: string;
    platform: string;
    raw_calendar_id: string;
    email?: string;
  };
}

// =============================================================================
// Query Keys
// =============================================================================

const meetingBaaSKeys = {
  all: ['meetingbaas'] as const,
  calendars: (userId: string) => [...meetingBaaSKeys.all, 'calendars', userId] as const,
};

// =============================================================================
// Hook
// =============================================================================

export function useMeetingBaaSCalendar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Fetch the user's MeetingBaaS calendar connections
  const {
    data: calendars,
    isLoading,
    error,
    refetch,
  } = useQuery<MeetingBaaSCalendar[]>({
    queryKey: meetingBaaSKeys.calendars(userId || ''),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('meetingbaas_calendars')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          console.log('[useMeetingBaaSCalendar] meetingbaas_calendars table does not exist yet');
          return [];
        }
        console.error('[useMeetingBaaSCalendar] Error fetching calendars:', error);
        throw error;
      }

      return (data as MeetingBaaSCalendar[]) || [];
    },
    enabled: !!userId,
    staleTime: 30000, // 30 seconds
  });

  // Connect calendar to MeetingBaaS
  const connectMutation = useMutation({
    mutationFn: async (calendarId: string = 'primary'): Promise<ConnectCalendarResponse> => {
      if (!userId) throw new Error('Not authenticated');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Call the edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meetingbaas-connect-calendar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: userId,
            calendar_id: calendarId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to connect calendar');
      }

      return result;
    },
    onSuccess: (data) => {
      toast.success('Calendar connected to MeetingBaaS', {
        description: data.message || 'Your calendar events will now be monitored for automatic recording.',
      });
      queryClient.invalidateQueries({ queryKey: meetingBaaSKeys.calendars(userId || '') });
    },
    onError: (error) => {
      toast.error('Failed to connect calendar', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  // Disconnect calendar from MeetingBaaS
  const disconnectMutation = useMutation({
    mutationFn: async (calendarId: string) => {
      if (!userId) throw new Error('Not authenticated');

      // Mark as inactive in our database
      const { error } = await supabase
        .from('meetingbaas_calendars')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', calendarId)
        .eq('user_id', userId);

      if (error) throw error;

      // TODO: Call MeetingBaaS API to delete the calendar connection
      // This would require adding a delete endpoint to the edge function
    },
    onSuccess: () => {
      toast.success('Calendar disconnected from MeetingBaaS');
      queryClient.invalidateQueries({ queryKey: meetingBaaSKeys.calendars(userId || '') });
    },
    onError: (error) => {
      toast.error('Failed to disconnect calendar', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });

  // Computed states
  const hasConnectedCalendar = (calendars?.length ?? 0) > 0;
  const primaryCalendar = calendars?.find((c) => c.raw_calendar_id === 'primary') || calendars?.[0];

  return {
    // Data
    calendars,
    primaryCalendar,
    hasConnectedCalendar,

    // Loading states
    isLoading,
    error,

    // Actions
    connect: connectMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    refetch,

    // Mutation states
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
