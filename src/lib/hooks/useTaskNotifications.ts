import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface TaskNotification {
  id: string;
  user_id: string;
  meeting_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  task_count: number;
  metadata: {
    task_ids?: string[];
    meeting_title?: string;
    source?: string;
  };
  read: boolean;
  created_at: string;
}

export function useTaskNotifications() {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('task_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read).length);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: count, error } = await supabase.rpc('mark_all_notifications_read');

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      if (count > 0) {
        toast.success(`Marked ${count} notification${count > 1 ? 's' : ''} as read`);
      }
    } catch (error) {
    }
  };

  const showNotificationToast = (notification: TaskNotification) => {
    const taskCount = notification.task_count || 0;
    const meetingTitle = notification.metadata?.meeting_title || 'Unknown Meeting';

    toast.success(notification.title, {
      description: notification.message,
      duration: 5000,
      action: notification.meeting_id
        ? {
            label: 'View Meeting',
            onClick: () => {
              markAsRead(notification.id);
              navigate(`/meetings/${notification.meeting_id}`);
            }
          }
        : undefined,
      onDismiss: () => markAsRead(notification.id),
      onAutoClose: () => markAsRead(notification.id)
    });
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to real-time notifications
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return null;

      const channel = supabase
        .channel('task_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'task_notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newNotification = payload.new as TaskNotification;

            // Add to list
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Show toast
            showNotificationToast(newNotification);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'task_notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const updatedNotification = payload.new as TaskNotification;

            // Update notification in list
            setNotifications(prev =>
              prev.map(n => (n.id === updatedNotification.id ? updatedNotification : n))
            );

            // Recalculate unread count
            setNotifications(prev => {
              setUnreadCount(prev.filter(n => !n.read).length);
              return prev;
            });
          }
        )
        .subscribe();

      return channel;
    };

    let channel: any = null;

    setupRealtimeSubscription().then(ch => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
}
