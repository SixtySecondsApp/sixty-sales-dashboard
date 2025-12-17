-- =====================================================
-- FIX WAITLIST TRIGGERS - COMPLETE FIX
-- =====================================================
-- This fixes the conflicting triggers that are preventing waitlist registration
-- Run this in Supabase SQL Editor
-- Date: 2025-12-16

-- PROBLEM: There are multiple conflicting triggers:
-- 1. Old calculate_position_trigger (uses 5 spots per referral)
-- 2. New calculate_points_trigger (uses 50 points per referral, 1 spot per 10 points)
-- These conflict and can cause insert failures

-- Step 1: Drop the OLD conflicting trigger
DROP TRIGGER IF EXISTS calculate_position_trigger ON meetings_waitlist;

-- Step 2: Drop the NEW trigger (we'll recreate it correctly)
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;

-- Step 3: Drop the old function (if it exists)
DROP FUNCTION IF EXISTS calculate_effective_position();

-- Step 4: Create the CORRECT function that matches the latest migration
-- This uses: 50 points per referral, 1 spot per 10 points
CREATE OR REPLACE FUNCTION calculate_waitlist_points()
RETURNS TRIGGER AS $$
DECLARE
  points INTEGER := 0;
BEGIN
  -- Base points from referrals (50 points per referral - CORRECT)
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

  -- Set total points
  NEW.total_points := points;

  -- CRITICAL: Update effective_position based on points
  -- Formula: MAX(1, signup_position - floor(points / 10))
  -- This means every 10 points = 1 spot forward
  -- Only calculate if signup_position is set (it will be set by set_signup_position_trigger)
  IF NEW.signup_position IS NOT NULL THEN
    NEW.effective_position := GREATEST(1, NEW.signup_position - FLOOR(points / 10));
  ELSE
    -- If signup_position is not set yet, set effective_position to NULL
    -- It will be calculated on the next update when signup_position is set
    NEW.effective_position := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the trigger that runs AFTER signup_position is set
-- This ensures signup_position is available when calculating effective_position
CREATE TRIGGER calculate_points_trigger
BEFORE INSERT OR UPDATE OF referral_count, linkedin_boost_claimed, twitter_boost_claimed, linkedin_share_claimed, signup_position
ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_points();

-- Step 6: Verify triggers are set up correctly
-- Should show: set_signup_position_trigger, calculate_points_trigger, set_referral_code_trigger
SELECT 
  tgname as trigger_name,
  CASE tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as timing,
  CASE tgtype::integer & 28
    WHEN 16 THEN 'UPDATE'
    WHEN 8 THEN 'DELETE'
    WHEN 4 THEN 'INSERT'
    WHEN 20 THEN 'INSERT OR UPDATE'
    WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
    ELSE 'UNKNOWN'
  END as events,
  tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'meetings_waitlist'::regclass
  AND tgname IN ('set_signup_position_trigger', 'calculate_points_trigger', 'set_referral_code_trigger', 'calculate_position_trigger')
ORDER BY tgname;

-- Step 7: Recalculate existing records with correct formula
UPDATE meetings_waitlist
SET
  total_points = (
    (COALESCE(referral_count, 0) * 50) +
    (CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END)
  ),
  effective_position = CASE 
    WHEN signup_position IS NOT NULL THEN
      GREATEST(1, signup_position - FLOOR(
        (COALESCE(referral_count, 0) * 50) +
        (CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END) +
        (CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END) +
        (CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END)
      ) / 10)
    ELSE NULL
  END;

-- Step 8: Test insert (uncomment to test)
-- This should work without errors:
/*
INSERT INTO meetings_waitlist (email, full_name, company_name, dialer_tool, meeting_recorder_tool, crm_tool)
VALUES ('test-fix@example.com', 'Test Fix', 'Test Company', 'Aircall', 'Fathom', 'Salesforce')
RETURNING id, email, signup_position, total_points, effective_position;
*/

-- Step 9: Show verification
SELECT
  full_name,
  email,
  signup_position,
  effective_position,
  signup_position - effective_position as positions_moved,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  FLOOR(total_points / 10) as expected_positions_moved,
  CASE 
    WHEN signup_position IS NOT NULL AND effective_position IS NOT NULL 
    THEN signup_position - effective_position = FLOOR(total_points / 10)
    ELSE NULL
  END as formula_matches
FROM meetings_waitlist
WHERE signup_position IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

