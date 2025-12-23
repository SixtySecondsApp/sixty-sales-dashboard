# Notification Read State Persistence - Fix Summary

## Problem
When users mark notifications as read, the read state was not persisting across page refreshes. The notifications would show as unread again after reloading the page.

## Root Cause
The `useTaskNotifications` hook was only listening for INSERT events via real-time subscriptions. When notifications were marked as read using the `mark_notification_read` RPC function, the database was updated correctly, but the real-time subscription didn't receive UPDATE events, so the local state would be overwritten when the page refreshed and `fetchNotifications()` ran again.

## Solution
Added a real-time subscription listener for UPDATE events on the `task_notifications` table. Now when a notification is marked as read (either locally or from another tab/device), the UPDATE event is received and the local state is synchronized automatically.

### Changes Made

**File: `/src/lib/hooks/useTaskNotifications.ts`**

Added UPDATE event listener to the real-time subscription:

```typescript
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
```

## How It Works

1. User clicks "Mark as Read" or "Mark All as Read"
2. RPC function `mark_notification_read` or `mark_all_notifications_read` updates the database
3. Supabase real-time subscription receives UPDATE event
4. Local state is updated with the new notification data (read: true)
5. Unread count is recalculated
6. On page refresh, `fetchNotifications()` retrieves the current state from database (with read: true)

## Testing Steps

1. Open the application in a browser
2. Navigate to notifications panel
3. Mark one or more notifications as read
4. Refresh the page (F5 or Cmd+R)
5. Verify that notifications remain marked as read
6. Test "Mark All as Read" functionality
7. Refresh and verify state persists

## Additional Benefits

- Multi-tab synchronization: If you mark a notification as read in one tab, it updates in all open tabs
- Multi-device synchronization: Updates propagate across devices viewing the same account
- Real-time updates: No need to manually refresh to see changes from other sessions

## Database Schema Reference

The `task_notifications` table structure:
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to auth.users
- `meeting_id` (UUID) - Optional reference to meetings
- `notification_type` (TEXT) - Type of notification
- `title` (TEXT) - Notification title
- `message` (TEXT) - Notification message
- `task_count` (INTEGER) - Number of tasks created
- `metadata` (JSONB) - Additional data
- **`read` (BOOLEAN)** - Read status (this is what we're tracking)
- `created_at` (TIMESTAMPTZ) - Creation timestamp

## RPC Functions

- `mark_notification_read(p_notification_id UUID)` - Marks single notification as read
- `mark_all_notifications_read()` - Marks all user notifications as read

Both functions use `SECURITY DEFINER` and validate user ownership via `auth.uid()`.
