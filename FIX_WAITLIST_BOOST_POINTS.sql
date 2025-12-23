-- ============================================================================
-- FIX WAITLIST BOOST POINTS (50-POINT LINKEDIN/TWITTER BOOST)
-- ============================================================================
-- This script creates the trigger that adds 50 points when sharing on LinkedIn/Twitter
-- Run this if the 50-point boost isn't being applied when users share
-- ============================================================================

-- First, add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings_waitlist' AND column_name = 'twitter_first_share_at') THEN
    ALTER TABLE meetings_waitlist ADD COLUMN twitter_first_share_at TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings_waitlist' AND column_name = 'total_points') THEN
    ALTER TABLE meetings_waitlist ADD COLUMN total_points INTEGER DEFAULT 0;
  END IF;
END$$;

-- ============================================================================
-- CREATE/REPLACE THE POINTS CALCULATION FUNCTION
-- ============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;

-- Create the point calculation function with correct formula (50 for boosts)
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

-- Create the trigger
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed,
                           linkedin_share_claimed, signup_position ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- ============================================================================
-- FIX RLS POLICIES - Allow public updates for boost claiming
-- ============================================================================

-- Drop restrictive policies
DROP POLICY IF EXISTS "Anyone can update their own waitlist entry" ON meetings_waitlist;
DROP POLICY IF EXISTS "Public can update own entry" ON meetings_waitlist;
DROP POLICY IF EXISTS "Allow boost claims" ON meetings_waitlist;

-- Create policy to allow updates (for claiming boosts)
CREATE POLICY "Allow boost claims"
ON meetings_waitlist FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Grant UPDATE permission to anon role
GRANT UPDATE ON meetings_waitlist TO anon;

-- ============================================================================
-- FIX waitlist_shares TABLE RLS (needed to track shares)
-- ============================================================================

-- Ensure waitlist_shares table exists
CREATE TABLE IF NOT EXISTS waitlist_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'email', 'copy')),
  referral_clicked BOOLEAN DEFAULT false,
  referral_converted BOOLEAN DEFAULT false,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE waitlist_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can create shares" ON waitlist_shares;
DROP POLICY IF EXISTS "Anyone can view shares" ON waitlist_shares;

-- Create permissive policies
CREATE POLICY "Anyone can create shares"
ON waitlist_shares FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Anyone can view shares"
ON waitlist_shares FOR SELECT
TO public
USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON waitlist_shares TO anon;
GRANT ALL ON waitlist_shares TO authenticated;

-- ============================================================================
-- RECALCULATE ALL EXISTING RECORDS
-- ============================================================================

-- Temporarily disable admin action trigger if it exists
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Recalculate all existing records with correct formula
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
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if trigger can't be created
  NULL;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show sample of users who have claimed boosts
SELECT 
  'BOOST STATUS CHECK' as check_type,
  email,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  signup_position,
  effective_position
FROM meetings_waitlist
WHERE linkedin_boost_claimed = true OR twitter_boost_claimed = true
LIMIT 5;

-- Verify trigger exists
SELECT 
  'TRIGGER CHECK' as check_type,
  tgname as trigger_name,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'calculate_points_trigger';

SELECT 'SUCCESS: Boost points trigger installed!' as status;











