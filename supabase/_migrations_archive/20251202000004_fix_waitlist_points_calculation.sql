-- Migration: Fix Waitlist Points Calculation & Position Ties
-- Purpose: Ensure correct point calculation (50 per referral, not 5) and handle position ties
-- Date: 2025-12-02

-- Drop existing trigger to ensure clean slate
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;

-- Recreate the point calculation function with correct formula
CREATE OR REPLACE FUNCTION calculate_waitlist_points()
RETURNS TRIGGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  -- Base points from referrals (50 points per referral, NOT 5)
  points := points + (COALESCE(NEW.referral_count, 0) * 50);

  -- LinkedIn boost (100 points)
  IF COALESCE(NEW.linkedin_boost_claimed, false) THEN
    points := points + 100;
  END IF;

  -- Twitter boost (100 points)
  IF COALESCE(NEW.twitter_boost_claimed, false) THEN
    points := points + 100;
  END IF;

  -- LinkedIn share (25 points)
  IF COALESCE(NEW.linkedin_share_claimed, false) THEN
    points := points + 25;
  END IF;

  -- Position bonus (extra points for being in top positions)
  IF NEW.effective_position IS NOT NULL THEN
    IF NEW.effective_position <= 10 THEN
      points := points + 500; -- Top 10
    ELSIF NEW.effective_position <= 50 THEN
      points := points + 200; -- Top 50
    ELSIF NEW.effective_position <= 100 THEN
      points := points + 100; -- Top 100
    END IF;
  END IF;

  NEW.total_points := points;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with correct dependencies
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed,
                           linkedin_share_claimed, effective_position ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- Force recalculation of ALL existing records with the correct formula
-- First, recalculate effective_position to ensure it's correct
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - (COALESCE(referral_count, 0) * 5))
WHERE effective_position IS NULL OR effective_position != GREATEST(1, signup_position - (COALESCE(referral_count, 0) * 5));

-- Then recalculate total_points for all records
UPDATE meetings_waitlist
SET total_points = (
  (COALESCE(referral_count, 0) * 50) + -- 50 points per referral
  CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 100 ELSE 0 END +
  CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 100 ELSE 0 END +
  CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END +
  CASE
    WHEN effective_position <= 10 THEN 500
    WHEN effective_position <= 50 THEN 200
    WHEN effective_position <= 100 THEN 100
    ELSE 0
  END
)
WHERE total_points != (
  (COALESCE(referral_count, 0) * 50) +
  CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 100 ELSE 0 END +
  CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 100 ELSE 0 END +
  CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END +
  CASE
    WHEN effective_position <= 10 THEN 500
    WHEN effective_position <= 50 THEN 200
    WHEN effective_position <= 100 THEN 100
    ELSE 0
  END
);

-- Add helpful comments
COMMENT ON FUNCTION calculate_waitlist_points IS 'Calculates total gamification points: 50 per referral (NOT 5!), 100 for social boosts, 25 for shares, plus position bonuses (500/200/100)';
