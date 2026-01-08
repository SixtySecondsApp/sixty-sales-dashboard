-- Migration: Add working hours preferences to profiles table
-- Purpose: Enable smart polling based on user's working hours and timezone
-- Part of API Call Optimization initiative

-- Add working hours preferences to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS working_hours_start integer DEFAULT 8,
ADD COLUMN IF NOT EXISTS working_hours_end integer DEFAULT 18,
ADD COLUMN IF NOT EXISTS timezone text;

-- Add constraints to ensure valid hour values
ALTER TABLE profiles
ADD CONSTRAINT valid_working_hours_start
CHECK (working_hours_start >= 0 AND working_hours_start <= 23);

ALTER TABLE profiles
ADD CONSTRAINT valid_working_hours_end
CHECK (working_hours_end >= 0 AND working_hours_end <= 23);

-- Add comment for documentation
COMMENT ON COLUMN profiles.working_hours_start IS 'Hour of day (0-23) when working hours begin. Default 8 (8 AM). Used for smart polling.';
COMMENT ON COLUMN profiles.working_hours_end IS 'Hour of day (0-23) when working hours end. Default 18 (6 PM). Used for smart polling.';
COMMENT ON COLUMN profiles.timezone IS 'User timezone (IANA format, e.g., America/New_York). NULL means auto-detect from browser.';

-- Create index for timezone lookups (optional, for admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone) WHERE timezone IS NOT NULL;
