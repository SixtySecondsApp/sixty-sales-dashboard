-- Migration: Add timezone and week start preferences to profiles
-- Purpose: Enable timezone-aware relative date parsing for meeting queries
-- Used by: useUserTimezone hook, copilot meeting queries

-- ============================================================================
-- Add timezone column
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.timezone IS 'IANA timezone identifier (e.g., Europe/London, America/New_York). NULL means auto-detect from browser.';

-- ============================================================================
-- Add week_starts_on column
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS week_starts_on INTEGER DEFAULT 1
    CONSTRAINT week_starts_on_check CHECK (week_starts_on IN (0, 1));

COMMENT ON COLUMN profiles.week_starts_on IS 'Day of week to start on: 0 = Sunday, 1 = Monday (default)';

-- ============================================================================
-- Create index for timezone queries (optional but helpful for analytics)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_timezone
  ON profiles(timezone)
  WHERE timezone IS NOT NULL;

-- ============================================================================
-- Grant permissions (profiles already has RLS, so these are for service role)
-- ============================================================================

-- No explicit grants needed - profiles table already has appropriate policies
-- The existing RLS policies will apply to the new columns automatically
