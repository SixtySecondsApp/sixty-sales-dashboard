-- Fix waitlist_admin_actions trigger to gracefully handle missing table
-- This makes the trigger function resilient - it won't fail if the table doesn't exist
-- No dropping or recreating of triggers/tables - just updating the function

-- Update the trigger function to handle errors gracefully
CREATE OR REPLACE FUNCTION log_waitlist_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val VARCHAR(50);
  prev_value JSONB;
  new_value JSONB;
BEGIN
  -- Check if the table exists before trying to log
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'waitlist_admin_actions'
  ) THEN
    -- Table doesn't exist, just return without logging
    RETURN NEW;
  END IF;

  -- Determine action type based on what changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Check for specific status changes
    IF NEW.status = 'released' AND OLD.status != 'released' THEN
      action_type_val := 'release';
    ELSIF OLD.status = 'released' AND NEW.status != 'released' THEN
      action_type_val := 'unrelease';
    ELSE
      action_type_val := 'status_change';
    END IF;
    prev_value := jsonb_build_object('status', OLD.status);
    new_value := jsonb_build_object('status', NEW.status);
  ELSIF OLD.effective_position IS DISTINCT FROM NEW.effective_position THEN
    action_type_val := 'adjust_position';
    prev_value := jsonb_build_object('position', OLD.effective_position);
    new_value := jsonb_build_object('position', NEW.effective_position);
  ELSIF OLD.admin_notes IS DISTINCT FROM NEW.admin_notes THEN
    action_type_val := 'notes_update';
    prev_value := jsonb_build_object('notes', OLD.admin_notes);
    new_value := jsonb_build_object('notes', NEW.admin_notes);
  ELSIF OLD.granted_access_at IS NULL AND NEW.granted_access_at IS NOT NULL THEN
    action_type_val := 'grant_access';
    prev_value := jsonb_build_object('granted', false);
    new_value := jsonb_build_object('granted', true, 'granted_at', NEW.granted_access_at);
  ELSE
    -- No relevant change, skip logging
    RETURN NEW;
  END IF;

  -- Try to insert audit log, but don't fail if it doesn't work
  BEGIN
    INSERT INTO waitlist_admin_actions (
      waitlist_entry_id,
      admin_user_id,
      action_type,
      previous_value,
      new_value
    ) VALUES (
      NEW.id,
      COALESCE(NEW.granted_by, auth.uid()),
      action_type_val,
      prev_value,
      new_value
    );
  EXCEPTION WHEN OTHERS THEN
    -- If insert fails for any reason (table doesn't exist, RLS blocks it, etc.),
    -- just continue - don't let the trigger block the update
    -- This allows releases/unreleases to work even if logging fails
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_waitlist_admin_action() IS 'Logs admin actions on waitlist entries. Gracefully handles missing waitlist_admin_actions table - updates will still succeed even if logging fails.';
