import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleApi } from '@/lib/api/googleIntegration';
import { supabase } from '@/lib/supabase/clientV2';
import type { PostgrestError } from '@supabase/supabase-js';

// Query Keys
export const GOOGLE_QUERY_KEYS = {
  integration: ['google', 'integration'] as const,
  health: ['google', 'health'] as const,
  services: ['google', 'services'] as const,
  gmail: {
    emails: (query?: string) => ['google', 'gmail', 'emails', query] as const,
    labels: ['google', 'gmail', 'labels'] as const,
    message: (messageId: string | null) => ['google', 'gmail', 'message', messageId] as const,
  },
  calendar: {
    events: (timeMin?: string, timeMax?: string) => ['google', 'calendar', 'events', timeMin, timeMax] as const,
    calendars: ['google', 'calendar', 'calendars'] as const,
  },
  drive: {
    files: (folderId?: string) => ['google', 'drive', 'files', folderId] as const,
    folders: ['google', 'drive', 'folders'] as const,
  },
} as const;

// Main integration hook
export function useGoogleIntegration() {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.integration,
    queryFn: googleApi.getStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// Health check hook
export function useGoogleIntegrationHealth() {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.health,
    queryFn: googleApi.getHealth,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

// Service status hook
export function useGoogleServiceStatus() {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.services,
    queryFn: googleApi.getServiceStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// OAuth mutation hooks
export function useGoogleOAuthInitiate() {
  return useMutation({
    mutationFn: googleApi.initiateOAuth,
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
    },
  });
}

export function useGoogleDisconnect() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: googleApi.disconnect,
    onSuccess: () => {
      // Invalidate all Google-related queries
      queryClient.invalidateQueries({ queryKey: ['google'] });
      
      // Clear specific cached data
      queryClient.removeQueries({ queryKey: ['google'] });
    },
  });
}

// Service toggle mutation
export function useGoogleServiceToggle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ service, enabled }: { service: string; enabled: boolean }) =>
      googleApi.toggleService(service as any, enabled),
    onSuccess: () => {
      // Invalidate service status
      queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEYS.services });
    },
  });
}

// Gmail hooks
export function useGmailLabels(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.gmail.labels,
    queryFn: async () => {
      // The Edge Function expects action as a query parameter
      const response = await supabase.functions.invoke('google-gmail?action=list-labels', {
        body: {}
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes - labels don't change often
    retry: 1,
  });
}

export function useGmailEmails(query?: string, enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.gmail.emails(query),
    queryFn: async () => {
      // Use supabase.functions.invoke which handles CORS automatically
      const response = await supabase.functions.invoke('google-gmail', {
        body: { 
          action: 'list',
          query,
          maxResults: 50
        }
      });
      
      if (response.error) {
        // Provide more detailed error information
        const errorMessage = response.error.message || 'Unknown error';
        throw new Error(`Gmail API error: ${errorMessage}`);
      }
      
      return response.data;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

export function useGmailGetMessage(messageId: string | null, enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.gmail.message(messageId),
    queryFn: async () => {
      if (!messageId) throw new Error('Message ID is required');
      
      const response = await supabase.functions.invoke('google-gmail', {
        body: { 
          action: 'get',
          messageId
        }
      });
      
      if (response.error) {
        const errorMessage = response.error.message || 'Unknown error';
        throw new Error(`Gmail API error: ${errorMessage}`);
      }
      
      return response.data;
    },
    enabled: enabled && !!messageId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useGmailSend() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (emailData: { to: string; subject: string; body: string; isHtml?: boolean; cc?: string; bcc?: string; attachments?: any[] }) => {
      const response = await supabase.functions.invoke('google-gmail?action=send', {
        body: emailData
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate email lists to show the sent email
      queryClient.invalidateQueries({ queryKey: ['google', 'gmail', 'emails'] });
    },
  });
}

// Calendar hooks
export function useCalendarEvents(timeMin?: string, timeMax?: string, enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.calendar.events(timeMin, timeMax),
    queryFn: async () => {
      // The Edge Function expects action as a query parameter
      const response = await supabase.functions.invoke('google-calendar?action=list-events', {
        body: {
          timeMin,
          timeMax,
          maxResults: 100
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}

export function useCalendarList(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.calendar.calendars,
    queryFn: async () => {
      // The Edge Function expects action as a query parameter
      const response = await supabase.functions.invoke('google-calendar?action=list-calendars', {
        body: {}
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventData: any) => {
      const response = await supabase.functions.invoke('google-calendar?action=create-event', {
        body: eventData
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEYS.calendar.events() });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ eventId, ...eventData }: any) => {
      const response = await supabase.functions.invoke('google-calendar?action=update-event', {
        body: { eventId, ...eventData }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEYS.calendar.events() });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await supabase.functions.invoke('google-calendar?action=delete-event', {
        body: { eventId, calendarId: 'primary' }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_QUERY_KEYS.calendar.events() });
    },
  });
}

export function useCreateCalendarEventOld() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (eventData: {
      summary: string;
      description?: string;
      startTime: string;
      endTime: string;
      attendees?: string[];
      location?: string;
      calendarId?: string;
    }) => {
      const response = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'create-event',
          ...eventData
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate calendar events to show the new event
      queryClient.invalidateQueries({ queryKey: ['google', 'calendar', 'events'] });
    },
  });
}

// Calendar Availability hook
export function useCheckCalendarAvailability() {
  return useMutation({
    mutationFn: async ({ timeMin, timeMax, calendarId }: { 
      timeMin: string; 
      timeMax: string; 
      calendarId?: string 
    }) => {
      const response = await supabase.functions.invoke('google-calendar?action=availability', {
        body: { timeMin, timeMax, calendarId }
      });
      
      if (response.error) throw response.error;
      return response.data;
    }
  });
}

// Drive hooks
export function useDriveFiles(folderId?: string, enabled = true) {
  return useQuery({
    queryKey: GOOGLE_QUERY_KEYS.drive.files(folderId),
    queryFn: async () => {
      const response = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'list-files',
          folderId,
          maxResults: 100
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useCreateDriveFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (folderData: { name: string; parentId?: string }) => {
      const response = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'create-folder',
          ...folderData
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the folder contents to show the new folder
      queryClient.invalidateQueries({ 
        queryKey: GOOGLE_QUERY_KEYS.drive.files(variables.parentId) 
      });
    },
  });
}

export function useUploadDriveFile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (fileData: {
      name: string;
      content: string;
      mimeType: string;
      parentId?: string;
    }) => {
      const response = await supabase.functions.invoke('google-drive', {
        body: {
          action: 'upload-file',
          ...fileData
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the folder contents to show the new file
      queryClient.invalidateQueries({ 
        queryKey: GOOGLE_QUERY_KEYS.drive.files(variables.parentId) 
      });
    },
  });
}

// Utility hooks
export function useGoogleIntegrationEnabled() {
  const { data: integration } = useGoogleIntegration();
  const { data: health } = useGoogleIntegrationHealth();
  
  return {
    isEnabled: !!integration && health?.isConnected,
    integration,
    health
  };
}

export function useGoogleServiceEnabled(service: 'gmail' | 'calendar' | 'drive') {
  const { data: services } = useGoogleServiceStatus();
  const { isEnabled: isIntegrationEnabled } = useGoogleIntegrationEnabled();
  
  return isIntegrationEnabled && services?.[service];
}

// Gmail Action Hooks
export function useGmailMarkAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ messageId, read }: { messageId: string; read: boolean }) => {
      // Validate inputs before making the request
      if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
        throw new Error('messageId is required and must be a non-empty string');
      }
      if (typeof read !== 'boolean') {
        throw new Error('read must be a boolean');
      }

      const response = await supabase.functions.invoke('google-gmail?action=mark-as-read', {
        body: { messageId: messageId.trim(), read }
      });
      
      if (response.error) {
        // Check if response.data contains error details
        const errorMessage = response.data?.error || response.error.message || 'Failed to mark email as read';
        throw new Error(errorMessage);
      }
      
      // Check if response.data indicates an error (Edge Function might return error in data)
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      return response.data;
    },
    onSuccess: () => {
      // Invalidate Gmail queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['google', 'gmail', 'emails'] });
    },
  });
}

export function useGmailStar() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ messageId, starred }: { messageId: string; starred: boolean }) => {
      const response = await supabase.functions.invoke('google-gmail?action=star', {
        body: { messageId, starred }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate Gmail queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['google', 'gmail', 'emails'] });
    },
  });
}

export function useGmailArchive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await supabase.functions.invoke('google-gmail?action=archive', {
        body: { messageId }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate Gmail queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['google', 'gmail', 'emails'] });
    },
  });
}

export function useGmailTrash() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await supabase.functions.invoke('google-gmail?action=delete', {
        body: { messageId }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      // Invalidate Gmail queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['google', 'gmail', 'emails'] });
    },
  });
}