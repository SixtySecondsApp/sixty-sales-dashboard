-- Add Waitlist Admin Actions tracking table
-- This migration adds audit trail for admin operations on waitlist entries

-- Create waitlist_admin_actions table
CREATE TABLE IF NOT EXISTS waitlist_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('grant_access', 'adjust_position', 'send_email', 'export_data', 'status_change', 'notes_update')),
  action_details JSONB,
  previous_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_actions_entry_id ON waitlist_admin_actions(waitlist_entry_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON waitlist_admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON waitlist_admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON waitlist_admin_actions(created_at DESC);

-- Add admin notes column to meetings_waitlist if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist'
    AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE meetings_waitlist
    ADD COLUMN admin_notes TEXT;

    RAISE NOTICE 'Added admin_notes column';
  ELSE
    RAISE NOTICE 'admin_notes column already exists';
  END IF;
END $$;

-- Add granted_access_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist'
    AND column_name = 'granted_access_at'
  ) THEN
    ALTER TABLE meetings_waitlist
    ADD COLUMN granted_access_at TIMESTAMPTZ;

    RAISE NOTICE 'Added granted_access_at column';
  ELSE
    RAISE NOTICE 'granted_access_at column already exists';
  END IF;
END $$;

-- Add granted_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist'
    AND column_name = 'granted_by'
  ) THEN
    ALTER TABLE meetings_waitlist
    ADD COLUMN granted_by UUID REFERENCES auth.users(id);

    RAISE NOTICE 'Added granted_by column';
  ELSE
    RAISE NOTICE 'granted_by column already exists';
  END IF;
END $$;

-- Create function to log admin actions automatically
CREATE OR REPLACE FUNCTION log_waitlist_admin_action()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val VARCHAR(50);
  prev_value JSONB;
  new_value JSONB;
BEGIN
  -- Determine action type based on what changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    action_type_val := 'status_change';
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

  -- Insert audit log
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic admin action logging
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;
CREATE TRIGGER log_admin_action_trigger
  AFTER UPDATE ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION log_waitlist_admin_action();

-- Verify tables were created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('waitlist_admin_actions', 'meetings_waitlist')
  AND column_name IN ('id', 'action_type', 'admin_notes', 'granted_access_at', 'granted_by')
ORDER BY table_name, ordinal_position;
