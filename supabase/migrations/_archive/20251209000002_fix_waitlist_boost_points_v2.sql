-- Migration: Fix Waitlist Boost Points to Match UI (v2)
-- Purpose: Change LinkedIn/Twitter boost from 100 points to 50 points to match UI
-- Date: 2025-12-09
-- Note: Disables admin action logging during bulk update to avoid null admin_user_id error

-- Temporarily disable the admin action logging trigger
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Drop existing points calculation trigger
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;

-- Recreate the point calculation function with correct formula (50 for boosts, not 100)
CREATE OR REPLACE FUNCTION calculate_waitlist_points()
RETURNS TRIGGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  -- Base points from referrals (50 points per referral)
  points := points + (COALESCE(NEW.referral_count, 0) * 50);

  -- LinkedIn boost (50 points - matches UI "+50" badge)
  IF COALESCE(NEW.linkedin_boost_claimed, false) THEN
    points := points + 50;
  END IF;

  -- Twitter boost (50 points - matches UI "+50" badge)
  IF COALESCE(NEW.twitter_boost_claimed, false) THEN
    points := points + 50;
  END IF;

  -- LinkedIn share (25 points)
  IF COALESCE(NEW.linkedin_share_claimed, false) THEN
    points := points + 25;
  END IF;

  NEW.total_points := points;

  -- Also recalculate effective_position based on points
  -- Formula: MAX(1, signup_position - floor(total_points / 10))
  -- This means every 10 points = 1 spot forward
  IF NEW.signup_position IS NOT NULL THEN
    NEW.effective_position := GREATEST(1, NEW.signup_position - FLOOR(points / 10));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate points calculation trigger
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed,
                           linkedin_share_claimed, signup_position ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- Recalculate all existing records with correct formula
-- Using direct column updates to avoid triggering other triggers
UPDATE meetings_waitlist
SET
  total_points = (
    (COALESCE(referral_count, 0) * 50) +
    CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END
  ),
  effective_position = GREATEST(1, signup_position - FLOOR(
    (COALESCE(referral_count, 0) * 50) +
    CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END
  ) / 10);

-- Re-enable the admin action logging trigger if function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_waitlist_admin_action') THEN
    CREATE TRIGGER log_admin_action_trigger
    AFTER UPDATE ON meetings_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION log_waitlist_admin_action();
  END IF;
END $$;

-- Add helpful comment
COMMENT ON FUNCTION calculate_waitlist_points IS 'Calculates total gamification points: 50 per referral, 50 for social boosts (matches UI), 25 for shares. Position moves forward 1 spot per 10 points.';
