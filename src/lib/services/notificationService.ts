import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory = 'workflow' | 'deal' | 'task' | 'meeting' | 'system' | 'team';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  category?: NotificationCategory;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  read: boolean;
  read_at?: string;
  action_url?: string;
  created_at: string;
  created_by?: string;
  workflow_execution_id?: string;
  expires_at?: string;
}

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, any>;
  action_url?: string;
  workflow_execution_id?: string;
  expires_at?: string;
}

class NotificationService {
  private channel: RealtimeChannel | null = null;
  private listeners: Set<(notification: Notification) => void> = new Set();
  private unreadCountListeners: Set<(count: number) => void> = new Set();

  /**
   * Create a new notification
   */
  async create(params: CreateNotificationParams): Promise<Notification | null> {
    try {
      // Get current user ID if not provided
      const { data: { user } } = await supabase.auth.getUser();
      const created_by = user?.id;

      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...params,
          created_by,
          type: params.type || 'info'
        })
        .select()
        .single();

      if (error) {
        console.error('[NotificationService] Error creating notification:', error);
        return null;
      }

      console.log('[NotificationService] Created notification:', data);
      return data;
    } catch (error) {
      console.error('[NotificationService] Exception creating notification:', error);
      return null;
    }
  }

  /**
   * Create notifications for multiple users
   */
  async createBulk(userIds: string[], params: Omit<CreateNotificationParams, 'user_id'>): Promise<Notification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const created_by = user?.id;

      const notifications = userIds.map(user_id => ({
        ...params,
        user_id,
        created_by,
        type: params.type || 'info'
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) {
        console.error('[NotificationService] Error creating bulk notifications:', error);
        return [];
      }

      console.log(`[NotificationService] Created ${data.length} notifications`);
      return data || [];
    } catch (error) {
      console.error('[NotificationService] Exception creating bulk notifications:', error);
      return [];
    }
  }

  /**
   * Get notifications for current user
   */
  async getNotifications(options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    category?: NotificationCategory;
  }): Promise<Notification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (options?.unreadOnly) {
        query = query.eq('read', false);
      }

      if (options?.category) {
        query = query.eq('category', options.category);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[NotificationService] Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[NotificationService] Exception fetching notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .rpc('get_unread_notification_count');

      if (error) {
        console.error('[NotificationService] Error getting unread count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('[NotificationService] Exception getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .rpc('mark_notification_read', { notification_id: notificationId });

      if (error) {
        console.error('[NotificationService] Error marking notification as read:', error);
        return false;
      }

      // Update unread count
      this.updateUnreadCount();
      return true;
    } catch (error) {
      console.error('[NotificationService] Exception marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<boolean> {
    try {
      const { error } = await supabase
        .rpc('mark_all_notifications_read');

      if (error) {
        console.error('[NotificationService] Error marking all notifications as read:', error);
        return false;
      }

      // Update unread count
      this.notifyUnreadCountListeners(0);
      return true;
    } catch (error) {
      console.error('[NotificationService] Exception marking all as read:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('[NotificationService] Error deleting notification:', error);
        return false;
      }

      // Update unread count
      this.updateUnreadCount();
      return true;
    } catch (error) {
      console.error('[NotificationService] Exception deleting notification:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(userId: string): void {
    // Unsubscribe from existing channel if any
    this.unsubscribe();

    // Create new channel
    this.channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notification = payload.new as Notification;
          console.log('[NotificationService] New notification received:', notification);
          
          // Show toast notification
          this.showToastNotification(notification);
          
          // Notify listeners
          this.notifyListeners(notification);
          
          // Update unread count
          this.updateUnreadCount();
        }
      )
      .subscribe();

    console.log('[NotificationService] Subscribed to notifications for user:', userId);
  }

  /**
   * Unsubscribe from real-time notifications
   */
  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('[NotificationService] Unsubscribed from notifications');
    }
  }

  /**
   * Add listener for new notifications
   */
  addNotificationListener(listener: (notification: Notification) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove notification listener
   */
  removeNotificationListener(listener: (notification: Notification) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Add listener for unread count changes
   */
  addUnreadCountListener(listener: (count: number) => void): void {
    this.unreadCountListeners.add(listener);
  }

  /**
   * Remove unread count listener
   */
  removeUnreadCountListener(listener: (count: number) => void): void {
    this.unreadCountListeners.delete(listener);
  }

  /**
   * Notify all listeners of new notification
   */
  private notifyListeners(notification: Notification): void {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('[NotificationService] Error in notification listener:', error);
      }
    });
  }

  /**
   * Notify all unread count listeners
   */
  private notifyUnreadCountListeners(count: number): void {
    this.unreadCountListeners.forEach(listener => {
      try {
        listener(count);
      } catch (error) {
        console.error('[NotificationService] Error in unread count listener:', error);
      }
    });
  }

  /**
   * Update unread count and notify listeners
   */
  private async updateUnreadCount(): Promise<void> {
    const count = await this.getUnreadCount();
    this.notifyUnreadCountListeners(count);
  }

  /**
   * Show toast notification
   */
  private showToastNotification(notification: Notification): void {
    const toastFn = toast[notification.type] || toast.info;
    
    toastFn(notification.title, {
      description: notification.message,
      action: notification.action_url ? {
        label: 'View',
        onClick: () => {
          // Navigate to action URL
          if (notification.action_url?.startsWith('/')) {
            window.location.href = notification.action_url;
          }
          // Mark as read
          this.markAsRead(notification.id);
        }
      } : undefined
    });
  }

  /**
   * Helper to determine recipients based on workflow configuration
   */
  async getWorkflowNotificationRecipients(
    notifyUsers: string,
    context: any
  ): Promise<string[]> {
    const recipients: string[] = [];

    switch (notifyUsers) {
      case 'current':
        const { data: { user } } = await supabase.auth.getUser();
        if (user) recipients.push(user.id);
        break;

      case 'owner':
        // Get owner from context (deal owner, task assignee, etc.)
        const ownerId = context.variables?.deal?.owner_id || 
                       context.variables?.task?.assigned_to;
        if (ownerId) recipients.push(ownerId);
        break;

      case 'team':
        // Get all team members
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id');
        if (profiles) {
          recipients.push(...profiles.map(p => p.id));
        }
        break;

      case 'specific':
        // Get specific users from node configuration
        const specificUsers = context.node?.data?.specificUsers || [];
        recipients.push(...specificUsers);
        break;

      default:
        // Default to current user
        const { data: { user: defaultUser } } = await supabase.auth.getUser();
        if (defaultUser) recipients.push(defaultUser.id);
    }

    // Remove duplicates
    return [...new Set(recipients)];
  }
}

// Export singleton instance
export const notificationService = new NotificationService();