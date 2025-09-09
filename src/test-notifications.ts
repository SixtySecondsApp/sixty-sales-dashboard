import { notificationService } from './lib/services/notificationService';
import { supabase } from './lib/supabase/clientV2';

/**
 * Test function to create sample notifications
 * Run this in the browser console or create a test button to trigger it
 */
export async function createTestNotifications() {
  try {
    console.log('🔔 Creating test notifications...');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return;
    }

    console.log(`Creating notifications for user: ${user.email}`);

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
      },
      {
        user_id: user.id,
        title: '👥 Team Update',
        message: 'Sarah Johnson closed a $75,000 deal! The team is now at 85% of quarterly target.',
        type: 'success' as const,
        category: 'team' as const,
        metadata: { team_progress: 85, quarter: 'Q1 2024' }
      },
      {
        user_id: user.id,
        title: '📊 Weekly Report Ready',
        message: 'Your weekly sales report is ready. You had 12 activities and moved 3 deals forward.',
        type: 'info' as const,
        category: 'system' as const,
        metadata: { activities_count: 12, deals_progressed: 3 },
        action_url: '/insights'
      },
      {
        user_id: user.id,
        title: '🔔 New Contact Added',
        message: 'John Smith from TechCorp was added to your contacts',
        type: 'info' as const,
        category: 'contact' as const,
        metadata: { company: 'TechCorp', role: 'VP of Sales' },
        action_url: '/contacts'
      },
      {
        user_id: user.id,
        title: '🎯 Goal Achievement',
        message: 'Congratulations! You\'ve reached your monthly activity target of 50 calls!',
        type: 'success' as const,
        category: 'achievement' as const,
        metadata: { goal_type: 'calls', target: 50, actual: 52 }
      }
    ];

    // Create notifications with slight delays to simulate real-time
    let createdCount = 0;
    for (const [index, notification] of testNotifications.entries()) {
      setTimeout(async () => {
        const result = await notificationService.create(notification);
        if (result) {
          createdCount++;
          console.log(`✅ Created notification ${index + 1}/${testNotifications.length}: "${notification.title}"`);
        } else {
          console.error(`❌ Failed to create notification: "${notification.title}"`);
        }
        
        if (index === testNotifications.length - 1) {
          console.log(`\n🎉 Successfully created ${createdCount} test notifications!`);
          console.log('Check the notification bell in the header to see them.');
        }
      }, index * 500); // 500ms delay between each notification
    }

  } catch (error) {
    console.error('Error creating test notifications:', error);
  }
}

/**
 * Function to clear all notifications for the current user
 */
export async function clearAllNotifications() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing notifications:', error);
    } else {
      console.log('✅ All notifications cleared successfully');
    }
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}

/**
 * Function to mark random notifications as read for testing
 */
export async function markRandomNotificationsAsRead() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return;
    }

    // Get all unread notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    if (!notifications || notifications.length === 0) {
      console.log('No unread notifications found');
      return;
    }

    // Mark random half as read
    const toMarkAsRead = notifications
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(notifications.length / 2));

    for (const notification of toMarkAsRead) {
      await notificationService.markAsRead(notification.id);
    }

    console.log(`✅ Marked ${toMarkAsRead.length} notifications as read`);
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
}

// Export for browser console access
if (typeof window !== 'undefined') {
  (window as any).testNotifications = {
    create: createTestNotifications,
    clear: clearAllNotifications,
    markSomeAsRead: markRandomNotificationsAsRead
  };
}