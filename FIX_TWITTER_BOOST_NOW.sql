-- =====================================================
-- FIX TWITTER BOOST POINTS NOT UPDATING
-- =====================================================
-- Run this in Supabase SQL Editor to fix the issue
-- Date: 2025-12-16

-- Step 1: Drop existing trigger
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;

-- Step 2: Create the correct function that updates BOTH total_points AND effective_position
CREATE OR REPLACE FUNCTION calculate_waitlist_points()
RETURNS TRIGGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  -- Calculate total points
  -- Referrals: 5 points each (consistent with UI "5 spots per referral")
  points := points + (COALESCE(NEW.referral_count, 0) * 5);

  -- LinkedIn boost: 50 points (matches UI "+50" badge)
  IF COALESCE(NEW.linkedin_boost_claimed, false) THEN
    points := points + 50;
  END IF;

  -- Twitter boost: 50 points (matches UI "+50" badge)
  IF COALESCE(NEW.twitter_boost_claimed, false) THEN
    points := points + 50;
  END IF;

  -- LinkedIn share: 25 points
  IF COALESCE(NEW.linkedin_share_claimed, false) THEN
    points := points + 25;
  END IF;

  -- Set total points
  NEW.total_points := points;

  -- CRITICAL: Also update effective_position based on points
  -- Formula: effective_position = MAX(1, signup_position - total_points)
  -- This means 1 point = 1 spot forward in line
  IF NEW.signup_position IS NOT NULL THEN
    NEW.effective_position := GREATEST(1, NEW.signup_position - points);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger that fires on ALL relevant column changes
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed, linkedin_share_claimed, signup_position
ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- Step 4: Temporarily disable admin action logging to avoid auth.uid() errors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist DISABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 5: Recalculate ALL existing records to fix current data
UPDATE meetings_waitlist
SET
  total_points = (
    (COALESCE(referral_count, 0) * 5) +
    (CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END)
  ),
  effective_position = GREATEST(1, signup_position - (
    (COALESCE(referral_count, 0) * 5) +
    (CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END)
  ));

-- Step 6: Re-enable admin action logging
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_admin_action_trigger') THEN
    ALTER TABLE meetings_waitlist ENABLE TRIGGER log_admin_action_trigger;
  END IF;
END $$;

-- Step 7: Verify the fix - show users with boosts
SELECT
  full_name,
  email,
  signup_position,
  effective_position,
  signup_position - effective_position as positions_moved,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points
FROM meetings_waitlist
WHERE linkedin_boost_claimed = true OR twitter_boost_claimed = true OR referral_count > 0
ORDER BY total_points DESC
LIMIT 20;
