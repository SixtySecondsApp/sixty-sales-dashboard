import { useEffect, useRef } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/clientV2';
import { GoogleTasksSyncService } from '@/lib/services/googleTasksSync';

/**
 * Background sync component that automatically syncs pending tasks
 * This runs in the background and syncs any tasks with sync_status='pending_sync'
 */
export function GoogleTasksBackgroundSync() {
  const { userData } = useUser();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<Date>(new Date());

  useEffect(() => {
    if (!userData?.id || userData.id === 'mock-user-id') return;

    const syncService = GoogleTasksSyncService.getInstance();

    // Function to sync pending tasks
    const syncPendingTasks = async () => {
      try {
        // Check if user is connected to Google Tasks
        const { data: syncStatus } = await supabase
          .from('google_tasks_sync_status')
          .select('is_connected')
          .eq('user_id', userData.id)
          .single();

        if (!syncStatus?.is_connected) return;

        // Get all pending tasks that haven't been synced yet
        const { data: pendingTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('assigned_to', userData.id)
          .eq('sync_status', 'pending_sync')
          .is('google_task_id', null)
          .limit(10); // Process in batches

        if (!pendingTasks || pendingTasks.length === 0) return;
        // Sync each pending task
        for (const task of pendingTasks) {
          await syncService.syncTaskImmediately(task, userData.id);
          // Small delay between syncs to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        lastSyncRef.current = new Date();
      } catch (error) {
      }
    };

    // Initial sync on mount
    syncPendingTasks();

    // Set up periodic sync every 30 seconds
    syncIntervalRef.current = setInterval(syncPendingTasks, 30000);

    // Also sync when the window regains focus
    const handleFocus = () => {
      const timeSinceLastSync = Date.now() - lastSyncRef.current.getTime();
      // Only sync if it's been more than 10 seconds since last sync
      if (timeSinceLastSync > 10000) {
        syncPendingTasks();
      }
    };

    window.addEventListener('focus', handleFocus);

    // Listen for real-time task updates
    const subscription = supabase
      .channel('task-sync-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${userData.id}`
        },
        (payload) => {
          // When a new task is created, sync it immediately
          if (payload.new && payload.new.sync_status === 'pending_sync' && !payload.new.google_task_id) {
            syncService.syncTaskImmediately(payload.new as any, userData.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${userData.id}`
        },
        (payload) => {
          // When a task is updated and needs sync
          if (payload.new && payload.new.sync_status === 'pending_sync' && payload.new.google_task_id) {
            syncService.syncTaskUpdateImmediately(payload.new.id as string, userData.id);
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      window.removeEventListener('focus', handleFocus);
      subscription.unsubscribe();
    };
  }, [userData]);

  // This component doesn't render anything
  return null;
}