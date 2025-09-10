import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { googleApi } from '@/lib/api/googleIntegration';
import { supabase } from '@/lib/supabase/clientV2';

// Query Keys
export const GOOGLE_QUERY_KEYS = {
  integration: ['google', 'integration'] as const,
  health: ['google', 'health'] as const,
  services: ['google', 'services'] as const,
  gmail: {
    emails: (query?: string) => ['google', 'gmail', 'emails', query] as const,
    labels: ['google', 'gmail', 'labels'] as const,
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
      const response = await supabase.functions.invoke('google-gmail', {
        body: { action: 'labels' }
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
      const response = await supabase.functions.invoke('google-gmail', {
        body: { 
          action: 'list',
          query,
          maxResults: 50
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

export function useGmailSend() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (emailData: { to: string; subject: string; body: string; isHtml?: boolean }) => {
      const response = await supabase.functions.invoke('google-gmail', {
        body: {
          action: 'send',
          ...emailData
        }
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
      const response = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'list-events',
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
      const response = await supabase.functions.invoke('google-calendar', {
        body: { action: 'list-calendars' }
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