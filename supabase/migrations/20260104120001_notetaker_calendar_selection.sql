-- Migration: Add calendar selection to notetaker user settings
-- Purpose: Allow users to select which calendar the 60 Notetaker watches
-- Date: 2026-01-04

-- =============================================================================
-- 1. Add selected_calendar_id column to notetaker_user_settings
-- =============================================================================

ALTER TABLE notetaker_user_settings
ADD COLUMN IF NOT EXISTS selected_calendar_id TEXT DEFAULT 'primary';

-- Add comment explaining the field
COMMENT ON COLUMN notetaker_user_settings.selected_calendar_id IS 'The Google Calendar ID to watch for meetings. Defaults to "primary".';

-- =============================================================================
-- 2. Create index for calendar filtering queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_notetaker_user_settings_calendar
ON notetaker_user_settings(selected_calendar_id)
WHERE selected_calendar_id IS NOT NULL;
