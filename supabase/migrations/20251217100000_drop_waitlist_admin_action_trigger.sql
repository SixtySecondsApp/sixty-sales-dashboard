-- Drop the waitlist admin action logging trigger
-- This trigger was trying to insert into waitlist_admin_actions table which doesn't exist
-- The trigger was causing errors when updating waitlist entries (releasing users, etc.)

DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Also drop the function if it exists (optional cleanup)
DROP FUNCTION IF EXISTS log_waitlist_admin_action();
