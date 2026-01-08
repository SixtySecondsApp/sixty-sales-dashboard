-- Migration: Add Gamification System to Waitlist
-- Purpose: Add total_points calculation and gamification tracking fields
-- Date: 2025-12-02

-- Add gamification tracking fields if they don't exist
DO $$
BEGIN
  -- Add total_points column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'total_points'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN total_points INTEGER DEFAULT 0 NOT NULL;
  END IF;

  -- Add linkedin_boost_claimed if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'linkedin_boost_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN linkedin_boost_claimed BOOLEAN DEFAULT false;
  END IF;

  -- Add twitter_boost_claimed if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'twitter_boost_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN twitter_boost_claimed BOOLEAN DEFAULT false;
  END IF;

  -- Add linkedin_share_claimed if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'linkedin_share_claimed'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN linkedin_share_claimed BOOLEAN DEFAULT false;
  END IF;

  -- Add linkedin_first_share_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings_waitlist' AND column_name = 'linkedin_first_share_at'
  ) THEN
    ALTER TABLE meetings_waitlist ADD COLUMN linkedin_first_share_at TIMESTAMP WITH TIME ZONE;
  END IF;
END
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_total_points ON meetings_waitlist(total_points DESC);

-- Add comments
COMMENT ON COLUMN meetings_waitlist.total_points IS 'Total gamification points earned (referrals + social boosts + achievements)';

-- Function to calculate total points based on gamification rules
CREATE OR REPLACE FUNCTION calculate_waitlist_points()
RETURNS TRIGGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  -- Base points from referrals (50 points per referral)
  points := points + (NEW.referral_count * 50);

  -- LinkedIn boost (100 points)
  IF NEW.linkedin_boost_claimed THEN
    points := points + 100;
  END IF;

  -- Twitter boost (100 points)
  IF NEW.twitter_boost_claimed THEN
    points := points + 100;
  END IF;

  -- LinkedIn share (25 points)
  IF NEW.linkedin_share_claimed THEN
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

-- Trigger to auto-calculate points on insert/update
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed,
                           linkedin_share_claimed, effective_position ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- Update existing records to calculate their points
UPDATE meetings_waitlist
SET updated_at = NOW(); -- This will trigger the point calculation for all existing records

-- Add helpful comment
COMMENT ON FUNCTION calculate_waitlist_points IS 'Calculates total gamification points: 50 per referral, 100 for social boosts, 25 for shares, plus position bonuses';
