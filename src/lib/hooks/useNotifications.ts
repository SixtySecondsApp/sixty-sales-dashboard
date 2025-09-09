import { useState, useEffect, useCallback } from 'react';
import { notificationService, type Notification, type NotificationCategory } from '@/lib/services/notificationService';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';

export interface UseNotificationsOptions {
  autoSubscribe?: boolean;
  category?: NotificationCategory;
  limit?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoSubscribe = true, category, limit = 50 } = options;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [notificationsList, count] = await Promise.all([
        notificationService.getNotifications({ limit, category }),
        notificationService.getUnreadCount()
      ]);

      setNotifications(notificationsList);
      setUnreadCount(count);
    } catch (err) {
      console.error('[useNotifications] Error fetching notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user, limit, category]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await notificationService.markAsRead(notificationId);
    if (success) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    return success;
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const success = await notificationService.markAllAsRead();
    if (success) {
      setNotifications(prev =>
        prev.map(n => ({
          ...n,
          read: true,
          read_at: new Date().toISOString()
        }))
      );
      setUnreadCount(0);
    }
    return success;
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    const success = await notificationService.deleteNotification(notificationId);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
    return success;
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.error('[useNotifications] Error clearing notifications:', err);
      return false;
    }
  }, [user]);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!user) return;

    try {
      const moreNotifications = await notificationService.getNotifications({
        limit,
        offset: notifications.length,
        category
      });

      setNotifications(prev => [...prev, ...moreNotifications]);
    } catch (err) {
      console.error('[useNotifications] Error loading more notifications:', err);
    }
  }, [user, notifications.length, limit, category]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user || !autoSubscribe) return;

    // Subscribe to real-time notifications
    notificationService.subscribeToNotifications(user.id);

    // Add listener for new notifications
    const handleNewNotification = (notification: Notification) => {
      // Only add if it matches the category filter (if set)
      if (!category || notification.category === category) {
        setNotifications(prev => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    // Add listener for unread count changes
    const handleUnreadCountChange = (count: number) => {
      setUnreadCount(count);
    };

    notificationService.addNotificationListener(handleNewNotification);
    notificationService.addUnreadCountListener(handleUnreadCountChange);

    // Cleanup
    return () => {
      notificationService.removeNotificationListener(handleNewNotification);
      notificationService.removeUnreadCountListener(handleUnreadCountChange);
      notificationService.unsubscribe();
    };
  }, [user, autoSubscribe, category]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    loadMore,
    refetch: fetchNotifications
  };
}