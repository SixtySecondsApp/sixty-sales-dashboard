/**
 * Meeting Action Items to Tasks Sync Service
 *
 * Manages bidirectional sync between Fathom meeting action items and CRM tasks.
 * Only syncs action items assigned to internal sales reps (not external prospects).
 *
 * Features:
 * - Automatic task creation from action items (via database trigger)
 * - Bidirectional sync of completion status and assignee
 * - Manual sync controls for individual items or entire meetings
 * - Sync status tracking and error handling
 * - Notification system for new tasks and deadlines
 */

import { supabase } from '../supabase/clientV2';

export interface MeetingActionItem {
  id: string;
  meeting_id: string;
  title: string;
  assignee_name: string | null;
  assignee_email: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  category: string | null;
  deadline_at: string | null;
  completed: boolean;
  ai_generated: boolean;
  timestamp_seconds: number | null;
  playback_url: string | null;
  task_id: string | null;
  synced_to_task: boolean;
  sync_status: 'pending' | 'synced' | 'failed' | 'excluded';
  sync_error: string | null;
  synced_at: string | null;
  created_at: string;
}

export interface ActionItemSyncResult {
  success: boolean;
  task_id?: string;
  sync_status?: string;
  sync_error?: string;
  error?: string;
}

export interface MeetingSyncResult {
  success: boolean;
  meeting_id?: string;
  synced: number;
  failed: number;
  excluded: number;
  already_synced: number;
  error?: string;
}

export interface TaskNotificationResult {
  success: boolean;
  upcoming_deadlines?: {
    success: boolean;
    notifications_sent: number;
    timestamp: string;
  };
  overdue_tasks?: {
    success: boolean;
    notifications_sent: number;
    timestamp: string;
  };
  timestamp?: string;
}

/**
 * Service for managing meeting action items to tasks sync
 */
export class MeetingActionItemsSyncService {
  /**
   * Get all action items for a meeting with sync status
   */
  static async getActionItemsForMeeting(meetingId: string): Promise<MeetingActionItem[]> {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Get action items with their linked tasks
   */
  static async getActionItemsWithTasks(meetingId: string) {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select(`
        *,
        task:tasks(
          id,
          title,
          description,
          due_date,
          completed,
          status,
          priority,
          assigned_to,
          task_type
        )
      `)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Manually sync a single action item to create a task
   * This calls the database function sync_action_item_to_task()
   */
  static async syncActionItemToTask(actionItemId: string): Promise<ActionItemSyncResult> {
    const { data, error } = await supabase.rpc('sync_action_item_to_task', {
      action_item_id: actionItemId
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return data as ActionItemSyncResult;
  }

  /**
   * Manually sync all action items for a meeting
   * This calls the database function sync_meeting_action_items()
   */
  static async syncMeetingActionItems(meetingId: string): Promise<MeetingSyncResult> {
    const { data, error } = await supabase.rpc('sync_meeting_action_items', {
      p_meeting_id: meetingId
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        synced: 0,
        failed: 0,
        excluded: 0,
        already_synced: 0
      };
    }

    return data as MeetingSyncResult;
  }

  /**
   * Get sync statistics for a meeting
   */
  static async getMeetingSyncStats(meetingId: string) {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select('sync_status, synced_to_task')
      .eq('meeting_id', meetingId);

    if (error) {
      throw error;
    }

    const stats = {
      total: data?.length || 0,
      synced: data?.filter(item => item.sync_status === 'synced').length || 0,
      pending: data?.filter(item => item.sync_status === 'pending').length || 0,
      failed: data?.filter(item => item.sync_status === 'failed').length || 0,
      excluded: data?.filter(item => item.sync_status === 'excluded').length || 0
    };

    return stats;
  }

  /**
   * Get all tasks created from meeting action items
   */
  static async getTasksFromMeetings(userId?: string) {
    let query = supabase
      .from('tasks')
      .select(`
        *,
        meeting_action_item:meeting_action_items(
          id,
          meeting_id,
          title,
          category,
          playback_url,
          ai_generated,
          meeting:meetings(
            id,
            title,
            meeting_start,
            share_url
          )
        )
      `)
      .not('meeting_action_item_id', 'is', null)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('assigned_to', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Update action item completion status
   * This will trigger bidirectional sync to update the linked task
   */
  static async updateActionItemCompletion(
    actionItemId: string,
    completed: boolean
  ): Promise<void> {
    const { error } = await supabase
      .from('meeting_action_items')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', actionItemId);

    if (error) {
      throw error;
    }
  }

  /**
   * Retry failed sync for action items
   */
  static async retryFailedSyncs(meetingId?: string) {
    let query = supabase
      .from('meeting_action_items')
      .select('id')
      .eq('sync_status', 'failed');

    if (meetingId) {
      query = query.eq('meeting_id', meetingId);
    }

    const { data: failedItems, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!failedItems || failedItems.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    const results = {
      retried: failedItems.length,
      succeeded: 0,
      failed: 0
    };

    // Retry each failed item
    for (const item of failedItems) {
      const result = await this.syncActionItemToTask(item.id);
      if (result.success && result.sync_status === 'synced') {
        results.succeeded++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Trigger task notifications (upcoming deadlines and overdue)
   * This calls the database function trigger_all_task_notifications()
   */
  static async triggerTaskNotifications(): Promise<TaskNotificationResult> {
    const { data, error } = await supabase.rpc('trigger_all_task_notifications');

    if (error) {
      return {
        success: false
      };
    }

    return data as TaskNotificationResult;
  }

  /**
   * Trigger upcoming deadline notifications only
   */
  static async notifyUpcomingDeadlines() {
    const { data, error } = await supabase.rpc('notify_upcoming_task_deadlines');

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Trigger overdue task notifications only
   */
  static async notifyOverdueTasks() {
    const { data, error } = await supabase.rpc('notify_overdue_tasks');

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Check if an email belongs to an internal user (sales rep)
   * This helps determine if an action item should be synced
   */
  static async isInternalAssignee(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') { 
      return false;
    }

    return !!data;
  }

  /**
   * Get sync status summary across all meetings
   */
  static async getGlobalSyncStats() {
    const { data, error } = await supabase
      .from('meeting_action_items')
      .select('sync_status, synced_to_task, task_id');

    if (error) {
      throw error;
    }

    const stats = {
      total: data?.length || 0,
      synced: data?.filter(item => item.sync_status === 'synced').length || 0,
      pending: data?.filter(item => item.sync_status === 'pending').length || 0,
      failed: data?.filter(item => item.sync_status === 'failed').length || 0,
      excluded: data?.filter(item => item.sync_status === 'excluded').length || 0,
      with_task: data?.filter(item => item.task_id !== null).length || 0
    };

    return stats;
  }

  /**
   * Subscribe to action item changes for real-time updates
   */
  static subscribeToActionItems(
    meetingId: string,
    callback: (payload: any) => void
  ) {
    const subscription = supabase
      .channel(`meeting_action_items:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_action_items',
          filter: `meeting_id=eq.${meetingId}`
        },
        callback
      )
      .subscribe();

    return subscription;
  }

  /**
   * Unsubscribe from action item changes
   */
  static async unsubscribeFromActionItems(subscription: any) {
    await supabase.removeChannel(subscription);
  }
}

export default MeetingActionItemsSyncService;
