import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gmailService, EmailSyncStatus } from '@/lib/services/gmailService';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

// Query keys for Gmail data
export const GMAIL_DB_QUERY_KEYS = {
  emails: (folder?: string, query?: string) => ['gmail', 'db', 'emails', folder, query] as const,
  threads: (isRead?: boolean, isArchived?: boolean) => ['gmail', 'db', 'threads', isRead, isArchived] as const,
  syncStatus: ['gmail', 'sync', 'status'] as const,
  historicalSyncStatus: ['gmail', 'sync', 'historical'] as const,
} as const;

/**
 * Hook to get Gmail emails from the database
 * This provides instant loading from the local database
 */
export function useGmailEmailsFromDB(
  options: {
    folder?: string;
    query?: string;
    limit?: number;
    offset?: number;
    isRead?: boolean;
    isStarred?: boolean;
  } = {},
  enabled = true
) {
  return useQuery({
    queryKey: GMAIL_DB_QUERY_KEYS.emails(options.folder, options.query),
    queryFn: () => gmailService.getEmailsFromDB(options),
    enabled,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to get email threads from the database
 */
export function useGmailThreadsFromDB(
  options: {
    limit?: number;
    offset?: number;
    isRead?: boolean;
    isArchived?: boolean;
  } = {},
  enabled = true
) {
  return useQuery({
    queryKey: GMAIL_DB_QUERY_KEYS.threads(options.isRead, options.isArchived),
    queryFn: () => gmailService.getEmailThreadsFromDB(options),
    enabled,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to sync Gmail emails to database
 */
export function useSyncGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action = 'sync-incremental',
      query,
      maxResults,
    }: {
      action?: 'sync-full' | 'sync-incremental' | 'sync-recent';
      query?: string;
      maxResults?: number;
    }) => {
      return gmailService.syncEmails(action, { query, maxResults });
    },
    onSuccess: () => {
      // Invalidate Gmail emails cache to show new data
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });
      queryClient.invalidateQueries({ queryKey: GMAIL_DB_QUERY_KEYS.syncStatus });
    },
  });
}

/**
 * Hook to get Gmail sync status
 * Only polls frequently when a sync is actively running
 */
export function useGmailSyncStatus(enabled = true) {
  return useQuery({
    queryKey: GMAIL_DB_QUERY_KEYS.syncStatus,
    queryFn: () => gmailService.getSyncStatus(),
    enabled,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    // Only poll when sync is actually in progress, otherwise rely on cache
    refetchInterval: (query) => {
      const status = query.state.data as EmailSyncStatus | undefined;
      // Poll every 5s during active sync, otherwise stop polling
      return status?.status === 'syncing' ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

/**
 * Hook to check if historical sync has been completed
 */
export function useHistoricalGmailSyncStatus(enabled = true) {
  return useQuery({
    queryKey: GMAIL_DB_QUERY_KEYS.historicalSyncStatus,
    queryFn: () => gmailService.isHistoricalSyncCompleted(),
    enabled,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });
}

/**
 * Hook to enable hourly background sync for Gmail
 * Syncs Gmail emails every hour to keep database fresh
 */
export function useHourlyGmailSync(enabled = true) {
  const syncGmail = useSyncGmail();
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

    // Sync recent emails every hour
    const syncRecentEmails = () => {
      console.log('[HOURLY-GMAIL-SYNC] Syncing recent emails');

      syncGmail.mutate({
        action: 'sync-recent',
        maxResults: 100, // Sync last 100 emails
      });
    };

    // Initial sync on mount
    syncRecentEmails();

    // Set up hourly interval (3600000 ms = 1 hour)
    syncIntervalRef.current = setInterval(syncRecentEmails, 3600000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [enabled, syncGmail.mutate]);

  return { isSyncing: syncGmail.isPending };
}

/**
 * Hook to mark email as read/unread
 */
export function useGmailMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ emailId, isRead }: { emailId: string; isRead: boolean }) =>
      gmailService.markAsRead(emailId, isRead),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });
    },
  });
}

/**
 * Hook to star/unstar email
 */
export function useGmailToggleStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ emailId, isStarred }: { emailId: string; isStarred: boolean }) =>
      gmailService.toggleStar(emailId, isStarred),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
    },
  });
}

/**
 * Hook to archive email
 */
export function useGmailArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => gmailService.archiveEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });
    },
  });
}

/**
 * Hook to delete email (move to trash)
 */
export function useGmailTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailId: string) => gmailService.trashEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
      queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });
    },
  });
}

/**
 * Hook to subscribe to real-time Gmail email changes
 * This allows for real-time updates when emails are modified
 */
export function useGmailEmailSubscription(
  enabled = true,
  onEmailUpdate?: (email: any) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const subscription = supabase
      .channel('gmail-emails-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emails',
        },
        (payload) => {
          console.log('[GMAIL-SUBSCRIPTION] Email change detected:', payload);

          // Invalidate the Gmail emails cache
          queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'emails'] });
          queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });

          // Call the callback if provided
          if (onEmailUpdate && payload.new) {
            onEmailUpdate(payload.new);
          }
        }
      )
      .subscribe();

    console.log('[GMAIL-SUBSCRIPTION] Subscribed to email changes');

    return () => {
      console.log('[GMAIL-SUBSCRIPTION] Unsubscribing from email changes');
      subscription.unsubscribe();
    };
  }, [enabled, queryClient, onEmailUpdate]);
}

/**
 * Hook to subscribe to real-time email thread changes
 */
export function useGmailThreadSubscription(
  enabled = true,
  onThreadUpdate?: (thread: any) => void
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const subscription = supabase
      .channel('gmail-threads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_threads',
        },
        (payload) => {
          console.log('[GMAIL-SUBSCRIPTION] Thread change detected:', payload);

          // Invalidate the Gmail threads cache
          queryClient.invalidateQueries({ queryKey: ['gmail', 'db', 'threads'] });

          // Call the callback if provided
          if (onThreadUpdate && payload.new) {
            onThreadUpdate(payload.new);
          }
        }
      )
      .subscribe();

    console.log('[GMAIL-SUBSCRIPTION] Subscribed to thread changes');

    return () => {
      console.log('[GMAIL-SUBSCRIPTION] Unsubscribing from thread changes');
      subscription.unsubscribe();
    };
  }, [enabled, queryClient, onThreadUpdate]);
}
