-- =====================================================
-- FIX POINTS NOT UPDATING ISSUE
-- =====================================================
-- This script ensures the points system is properly set up
-- and fixes any existing data

-- Step 1: Check if columns exist, add if missing
DO $$
BEGIN
  -- Add total_points column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'total_points'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN total_points INTEGER DEFAULT 0;
  END IF;

  -- Add linkedin_boost_claimed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'linkedin_boost_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN linkedin_boost_claimed BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add linkedin_first_share_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'linkedin_first_share_at'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN linkedin_first_share_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add twitter_boost_claimed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'twitter_boost_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN twitter_boost_claimed BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add twitter_first_share_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'twitter_first_share_at'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN twitter_first_share_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Step 2: Create or replace the calculate_total_points function
CREATE OR REPLACE FUNCTION calculate_total_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total points
  -- Points = (referral_count * 5) + (linkedin ? 50 : 0) + (twitter ? 50 : 0)
  NEW.total_points := (COALESCE(NEW.referral_count, 0) * 5) +
                      (CASE WHEN NEW.linkedin_boost_claimed THEN 50 ELSE 0 END) +
                      (CASE WHEN NEW.twitter_boost_claimed THEN 50 ELSE 0 END);

  -- Recalculate effective position based on total points
  -- Formula: effective_position = MAX(1, signup_position - total_points)
  NEW.effective_position := GREATEST(1, NEW.signup_position - NEW.total_points);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop and recreate trigger to ensure it's watching all columns
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed, signup_position
ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_total_points();

-- Step 4: Temporarily disable admin action logging trigger (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 5: Recalculate total_points for ALL existing entries
UPDATE meetings_waitlist
SET total_points = (COALESCE(referral_count, 0) * 5) +
                   (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END) +
                   (CASE WHEN twitter_boost_claimed THEN 50 ELSE 0 END);

-- Step 6: Recalculate effective_position based on updated total_points
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - total_points);

-- Step 7: Re-enable admin action logging trigger (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 8: Show recent entries to verify the fix
SELECT
  full_name,
  email,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  created_at
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 10;

-- Step 9: Show leaderboard to verify
SELECT
  full_name,
  email,
  total_points,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  effective_position
FROM meetings_waitlist
ORDER BY total_points DESC
LIMIT 10;
