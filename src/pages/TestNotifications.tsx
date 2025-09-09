import { useState } from 'react';
import { Bell, Trash2, CheckCheck, Plus, Loader2 } from 'lucide-react';
import { notificationService } from '@/lib/services/notificationService';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';

export default function TestNotifications() {
  const [isCreating, setIsCreating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const { notifications, unreadCount, markAllAsRead, refetch } = useNotifications();

  const createTestNotifications = async () => {
    try {
      setIsCreating(true);
      console.log('🔔 Creating test notifications...');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      // Create various types of notifications
      const testNotifications = [
        {
          user_id: user.id,
          title: '🎉 Welcome to Notifications!',
          message: 'Your in-app notification system is now active. Click here to explore.',
          type: 'success' as const,
          category: 'system' as const,
          action_url: '/workflows'
        },
        {
          user_id: user.id,
          title: '📈 New Deal Assigned',
          message: 'You have been assigned a new deal: "Enterprise Software Contract" worth $50,000',
          type: 'info' as const,
          category: 'deal' as const,
          metadata: { deal_value: 50000, deal_stage: 'SQL' },
          action_url: '/crm'
        },
        {
          user_id: user.id,
          title: '⚠️ Task Due Tomorrow',
          message: 'Reminder: "Follow up with client about proposal" is due tomorrow at 3:00 PM',
          type: 'warning' as const,
          category: 'task' as const,
          metadata: { task_priority: 'high', due_date: new Date(Date.now() + 86400000).toISOString() },
          action_url: '/tasks'
        },
        {
          user_id: user.id,
          title: '❌ Workflow Failed',
          message: 'The workflow "Lead Nurture Campaign" failed to execute. Check the error logs.',
          type: 'error' as const,
          category: 'workflow' as const,
          metadata: { workflow_name: 'Lead Nurture Campaign', error: 'Email service timeout' },
          action_url: '/workflows'
        },
        {
          user_id: user.id,
          title: '🤝 Meeting Starting Soon',
          message: 'Your meeting "Product Demo with Acme Corp" starts in 15 minutes',
          type: 'info' as const,
          category: 'meeting' as const,
          metadata: { meeting_time: new Date(Date.now() + 900000).toISOString() },
          action_url: '/meetings'
        },
        {
          user_id: user.id,
          title: '✅ Workflow Completed',
          message: 'Your automated workflow "New Deal Creation" has completed successfully. 3 tasks were created.',
          type: 'success' as const,
          category: 'workflow' as const,
          metadata: { tasks_created: 3, workflow_duration: '2.3s' },
          action_url: '/workflows'
        }
      ];

      // Create notifications with slight delays
      let createdCount = 0;
      for (const notification of testNotifications) {
        const result = await notificationService.create(notification);
        if (result) {
          createdCount++;
        }
        // Small delay between creations for visual effect
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      toast.success(`Created ${createdCount} test notifications!`);
      refetch();
    } catch (error) {
      console.error('Error creating test notifications:', error);
      toast.error('Failed to create test notifications');
    } finally {
      setIsCreating(false);
    }
  };

  const clearAllNotifications = async () => {
    try {
      setIsClearing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      toast.success('All notifications cleared');
      refetch();
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setIsClearing(false);
    }
  };

  const createCustomNotification = async () => {
    const title = prompt('Enter notification title:');
    if (!title) return;
    
    const message = prompt('Enter notification message:');
    if (!message) return;
    
    const type = prompt('Enter type (info/success/warning/error):', 'info');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      const result = await notificationService.create({
        user_id: user.id,
        title,
        message,
        type: type as any,
        category: 'system'
      });

      if (result) {
        toast.success('Custom notification created!');
        refetch();
      }
    } catch (error) {
      console.error('Error creating custom notification:', error);
      toast.error('Failed to create custom notification');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
          <div className="flex items-center gap-3 mb-8">
            <Bell className="w-8 h-8 text-[#37bd7e]" />
            <h1 className="text-3xl font-bold text-white">Notification System Test</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Current Status</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Notifications:</span>
                  <span className="text-white font-medium">{notifications.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unread Count:</span>
                  <span className="text-yellow-400 font-medium">{unreadCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Read Count:</span>
                  <span className="text-green-400 font-medium">{notifications.length - unreadCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Quick Info</h2>
              <div className="text-sm text-gray-400 space-y-1">
                <p>• Look for the bell icon in the header</p>
                <p>• Click it to see the notification panel</p>
                <p>• Notifications appear in real-time</p>
                <p>• Click notifications to mark as read</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Test Actions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={createTestNotifications}
                disabled={isCreating}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#37bd7e] hover:bg-[#2da76c] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create 6 Test Notifications
                  </>
                )}
              </button>

              <button
                onClick={createCustomNotification}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Custom Notification
              </button>

              <button
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCheck className="w-5 h-5" />
                Mark All as Read
              </button>

              <button
                onClick={clearAllNotifications}
                disabled={isClearing || notifications.length === 0}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Clear All Notifications
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">💡 Testing Tips</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Click "Create 6 Test Notifications" to generate sample notifications</li>
              <li>• Check the bell icon in the header - it should show a red badge with the count</li>
              <li>• Click the bell to open the notification panel</li>
              <li>• Try clicking on notifications to mark them as read</li>
              <li>• Test the "All" and "Unread" filters in the panel</li>
              <li>• Notifications with action URLs will navigate when clicked</li>
              <li>• Try deleting individual notifications with the trash icon</li>
            </ul>
          </div>

          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-green-400 mb-2">🔧 Browser Console Testing</h3>
            <p className="text-xs text-gray-400 mb-2">You can also test from the browser console:</p>
            <pre className="text-xs bg-gray-900 p-3 rounded overflow-x-auto">
              <code className="text-gray-300">{`// Create test notifications
testNotifications.create()

// Clear all notifications
testNotifications.clear()

// Mark some as read
testNotifications.markSomeAsRead()`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}