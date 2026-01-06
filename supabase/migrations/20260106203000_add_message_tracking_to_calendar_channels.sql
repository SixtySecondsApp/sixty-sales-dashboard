-- Migration: Add message number tracking to prevent webhook loops
-- Purpose: Track Google's incremental message numbers to deduplicate notifications
-- Date: 2026-01-06
--
-- Google sends X-Goog-Message-Number header that increments with each notification.
-- We can use this to detect and skip duplicate/out-of-order notifications that
-- might cause sync loops (like the 833 notifications issue).

-- =============================================================================
-- 1. Add last_message_number column
-- =============================================================================

DO $$
BEGIN
  -- Check if last_message_number column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'google_calendar_channels'
    AND column_name = 'last_message_number'
  ) THEN
    -- Add last_message_number column
    ALTER TABLE google_calendar_channels
    ADD COLUMN last_message_number BIGINT DEFAULT 0;

    -- Create index for efficient lookups
    CREATE INDEX idx_calendar_channels_message_number
      ON google_calendar_channels(last_message_number);

    RAISE NOTICE 'Added last_message_number column to google_calendar_channels';
  ELSE
    RAISE NOTICE 'last_message_number column already exists in google_calendar_channels';
  END IF;
END $$;

COMMENT ON COLUMN google_calendar_channels.last_message_number IS
  'Last processed X-Goog-Message-Number from Google Calendar webhook. Used to prevent processing duplicate or out-of-order notifications.';
