-- Migration: Add auto-join scheduler settings to recording_settings
-- Purpose: Add new configuration fields for automatic meeting recording
-- Date: 2026-01-04

-- =============================================================================
-- 1. Update default recording_settings with new auto-join fields
-- =============================================================================

-- Update the column default to include new fields
ALTER TABLE organizations
  ALTER COLUMN recording_settings
  SET DEFAULT '{
    "bot_name": "60 Notetaker",
    "bot_image_url": null,
    "entry_message_enabled": true,
    "entry_message": "Hi! I''m here to take notes so {rep_name} can focus on our conversation. 📝",
    "default_transcription_provider": "gladia",
    "recordings_enabled": false,
    "auto_record_enabled": false,
    "auto_record_lead_time_minutes": 2,
    "auto_record_external_only": true
  }';

-- =============================================================================
-- 2. Backfill existing organizations with new fields
--    Only add fields if they don't exist (preserve existing values)
-- =============================================================================

UPDATE organizations
SET recording_settings = recording_settings || jsonb_build_object(
  'auto_record_lead_time_minutes', 2,
  'auto_record_external_only', true
)
WHERE recording_settings IS NOT NULL
  AND NOT (recording_settings ? 'auto_record_lead_time_minutes');

-- =============================================================================
-- 3. Add org_id to calendar_events if not exists
--    This is needed for the auto-join scheduler to query by org
-- =============================================================================

-- Check if column exists and add if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE calendar_events
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

    -- Create index for efficient org-based queries
    CREATE INDEX IF NOT EXISTS idx_calendar_events_org_id ON calendar_events(org_id);

    -- Backfill org_id from user's organization membership
    UPDATE calendar_events ce
    SET org_id = om.org_id
    FROM organization_memberships om
    WHERE ce.user_id = om.user_id
      AND ce.org_id IS NULL;
  END IF;
END $$;

-- =============================================================================
-- 4. Create index for auto-join scheduler queries
--    Query pattern: events starting soon with meeting URLs
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_calendar_events_auto_join
  ON calendar_events(org_id, start_time)
  WHERE meeting_url IS NOT NULL;

-- =============================================================================
-- 5. Add trigger to auto-set org_id on calendar_events insert
-- =============================================================================

CREATE OR REPLACE FUNCTION set_calendar_event_org_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set org_id if not already provided
  IF NEW.org_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT om.org_id INTO NEW.org_id
    FROM organization_memberships om
    WHERE om.user_id = NEW.user_id
    ORDER BY om.created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_calendar_event_org_id_trigger ON calendar_events;
CREATE TRIGGER set_calendar_event_org_id_trigger
  BEFORE INSERT ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION set_calendar_event_org_id();

-- =============================================================================
-- 6. Update RLS policy for calendar_events to include org-based access
-- =============================================================================

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can view org calendar events" ON calendar_events;

-- Create new policy allowing org members to view all org events
CREATE POLICY "Users can view org calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id IN (
      SELECT om.org_id FROM organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );
