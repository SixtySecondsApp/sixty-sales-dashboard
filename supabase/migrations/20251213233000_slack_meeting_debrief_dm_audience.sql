-- Migration: Add dm_audience to slack_notification_settings
-- Purpose: Allow AI Meeting Debriefs to DM owner, stakeholder(s), or both.

DO $$
BEGIN
  -- Add column (idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'slack_notification_settings'
      AND column_name = 'dm_audience'
  ) THEN
    ALTER TABLE slack_notification_settings
      ADD COLUMN dm_audience TEXT DEFAULT 'owner';
  END IF;

  -- Add check constraint (idempotent)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'slack_notification_settings_dm_audience_chk'
  ) THEN
    ALTER TABLE slack_notification_settings
      ADD CONSTRAINT slack_notification_settings_dm_audience_chk
      CHECK (dm_audience IS NULL OR dm_audience IN ('owner', 'stakeholders', 'both'));
  END IF;
END;
$$;

COMMENT ON COLUMN slack_notification_settings.dm_audience IS 'When delivery_method includes DM (meeting debriefs), controls who receives DMs: owner, stakeholders, or both.';








