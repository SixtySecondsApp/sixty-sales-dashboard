-- =============================================================================
-- Fix mark_notification_read function to use the correct notifications table
-- and accept p_notification_id parameter (matching the service call)
-- =============================================================================

-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS public.mark_notification_read(UUID);
DROP FUNCTION IF EXISTS mark_notification_read(UUID);

-- Create the corrected function that:
-- 1. Uses the `notifications` table (not task_notifications)
-- 2. Accepts p_notification_id parameter (matching service call)
-- 3. Sets read_at timestamp
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.notifications
  SET 
    read = TRUE, 
    read_at = NOW()
  WHERE id = p_notification_id 
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

-- Also fix mark_all_notifications_read to ensure it uses the correct table
DROP FUNCTION IF EXISTS public.mark_all_notifications_read();
DROP FUNCTION IF EXISTS mark_all_notifications_read();

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET 
    read = TRUE, 
    read_at = NOW()
  WHERE user_id = auth.uid()
    AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

COMMENT ON FUNCTION public.mark_notification_read IS 'Marks a specific notification as read for the current user';
COMMENT ON FUNCTION public.mark_all_notifications_read IS 'Marks all unread notifications as read for the current user';
