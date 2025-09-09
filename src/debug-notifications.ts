import { supabase } from './lib/supabase/clientV2';
import { notificationService } from './lib/services/notificationService';

// Debug functions for testing notifications
export async function debugNotifications() {
  console.log('🔍 Debugging Notification System...');
  
  try {
    // 1. Check current user
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current User:', user?.email, user?.id);
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    // 2. Check notifications table
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
    } else {
      console.log(`✅ Found ${notifications?.length || 0} notifications:`, notifications);
    }
    
    // 3. Check unread count
    const unreadCount = await notificationService.getUnreadCount();
    console.log(`📊 Unread count: ${unreadCount}`);
    
    // 4. Test creating a notification
    console.log('🔄 Creating test notification...');
    const testNotification = await notificationService.create({
      user_id: user.id,
      title: '🧪 Debug Test Notification',
      message: `Test notification created at ${new Date().toLocaleTimeString()}`,
      type: 'info',
      category: 'system'
    });
    
    if (testNotification) {
      console.log('✅ Test notification created:', testNotification);
    } else {
      console.error('❌ Failed to create test notification');
    }
    
    // 5. Check real-time subscription
    console.log('🔄 Checking real-time subscription...');
    const subscription = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 Real-time notification received:', payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
    
    // Clean up subscription after 5 seconds
    setTimeout(() => {
      subscription.unsubscribe();
      console.log('📡 Unsubscribed from real-time notifications');
    }, 5000);
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Function to manually create notifications for the current user
export async function createNotificationsForCurrentUser() {
  console.log('📝 Creating notifications for current user...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('❌ No authenticated user found');
    return;
  }
  
  const notifications = [
    {
      user_id: user.id,
      title: '🎉 Welcome to Notifications!',
      message: 'Your notification system is working perfectly.',
      type: 'success' as const,
      category: 'system' as const,
      action_url: '/' // Navigate to dashboard
    },
    {
      user_id: user.id,
      title: '📈 New Deal Created',
      message: 'A new deal worth $50,000 has been added to your pipeline.',
      type: 'info' as const,
      category: 'deal' as const,
      entity_type: 'deal',
      action_url: '/pipeline' // Navigate to pipeline
    },
    {
      user_id: user.id,
      title: '⚠️ Task Due Soon',
      message: 'You have 3 tasks due tomorrow. Click to view your tasks.',
      type: 'warning' as const,
      category: 'task' as const,
      entity_type: 'task',
      action_url: '/tasks' // Navigate to tasks page
    },
    {
      user_id: user.id,
      title: '✅ Workflow Completed',
      message: 'Your automated workflow has finished successfully.',
      type: 'success' as const,
      category: 'workflow' as const,
      entity_type: 'workflow',
      action_url: '/workflows' // Navigate to workflows
    },
    {
      user_id: user.id,
      title: '👥 New Contact Added',
      message: 'John Smith from Acme Corp has been added to your contacts.',
      type: 'info' as const,
      category: 'contact' as const,
      entity_type: 'contact',
      action_url: '/crm?tab=contacts' // Navigate to CRM contacts tab
    },
    {
      user_id: user.id,
      title: '📊 Weekly Report Ready',
      message: 'Your weekly insights report is ready to view.',
      type: 'info' as const,
      category: 'system' as const,
      action_url: '/insights' // Navigate to insights page
    },
    {
      user_id: user.id,
      title: '📧 New Activity Logged',
      message: 'Email sent to prospect regarding proposal.',
      type: 'info' as const,
      category: 'activity' as const,
      entity_type: 'activity',
      action_url: '/activity' // Navigate to activity page
    },
    {
      user_id: user.id,
      title: '🏢 Company Profile Updated',
      message: 'Acme Corp profile has been updated with new information.',
      type: 'info' as const,
      category: 'company' as const,
      entity_type: 'company',
      action_url: '/crm?tab=companies' // Navigate to CRM companies tab
    }
  ];
  
  let created = 0;
  for (const notification of notifications) {
    const result = await notificationService.create(notification);
    if (result) {
      created++;
      console.log(`✅ Created: "${notification.title}"`);
    } else {
      console.error(`❌ Failed to create: "${notification.title}"`);
    }
  }
  
  console.log(`✅ Created ${created} out of ${notifications.length} notifications`);
  console.log('🔄 Refresh the page or check the notification bell to see them!');
}

// Make functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).debugNotifications = debugNotifications;
  (window as any).createNotificationsForCurrentUser = createNotificationsForCurrentUser;
  
  console.log('🔧 Debug functions loaded! Available commands:');
  console.log('  - debugNotifications() - Check notification system status');
  console.log('  - createNotificationsForCurrentUser() - Create test notifications for logged-in user');
}

// Auto-export for use in other modules
export default {
  debugNotifications,
  createNotificationsForCurrentUser
};