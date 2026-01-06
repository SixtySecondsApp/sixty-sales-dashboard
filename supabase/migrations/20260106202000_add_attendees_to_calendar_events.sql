-- Migration: Add attendees column to calendar_events
-- Purpose: Support auto-record trigger's external attendee detection
-- Date: 2026-01-06
--
-- The trigger_auto_record_for_new_event() function expects an attendees
-- JSONB column to check for external participants. This migration adds
-- that column to support the webhook sync functionality.

-- =============================================================================
-- 1. Add attendees JSONB column
-- =============================================================================

DO $$
BEGIN
  -- Check if attendees column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'attendees'
  ) THEN
    -- Add attendees column
    ALTER TABLE calendar_events
    ADD COLUMN attendees JSONB;

    -- Create GIN index for efficient JSONB queries
    CREATE INDEX idx_calendar_events_attendees
      ON calendar_events USING GIN (attendees);

    RAISE NOTICE 'Added attendees column to calendar_events';
  ELSE
    RAISE NOTICE 'attendees column already exists in calendar_events';
  END IF;
END $$;

COMMENT ON COLUMN calendar_events.attendees IS
  'JSONB array of event attendees from Google Calendar API. Used by auto-record trigger to detect external participants.';
