-- Migration: Fix Trigger Order for Waitlist
-- Purpose: Ensure signup_position is set BEFORE effective_position is calculated
-- Date: 2025-12-10
-- 
-- Issue: PostgreSQL executes BEFORE triggers alphabetically. Current order:
--   1. calculate_points_trigger (c...) - runs first, signup_position is NULL
--   2. calculate_position_trigger (c...) - runs second, still NULL -> effective_position = 1
--   3. set_signup_position_trigger (s...) - runs last, finally sets signup_position
--
-- Fix: Rename set_signup_position_trigger to run first (using 'aa_' prefix)

-- Step 1: Temporarily disable admin action logging (it requires auth.uid())
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Step 2: Drop the existing signup position trigger
DROP TRIGGER IF EXISTS set_signup_position_trigger ON meetings_waitlist;

-- Step 3: Recreate with a name that sorts first alphabetically
CREATE TRIGGER aa_set_signup_position_trigger
BEFORE INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION set_signup_position();

-- Step 4: Also drop the old calculate_position_trigger if it exists (superseded by calculate_points_trigger)
DROP TRIGGER IF EXISTS calculate_position_trigger ON meetings_waitlist;

-- Step 5: Fix any existing entries that have effective_position = 1 but should have higher position
-- Only fix entries where effective_position doesn't match the expected calculation
UPDATE meetings_waitlist
SET effective_position = GREATEST(1, signup_position - FLOOR(
    (COALESCE(referral_count, 0) * 50) +
    CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END
  ) / 10)
WHERE effective_position != GREATEST(1, signup_position - FLOOR(
    (COALESCE(referral_count, 0) * 50) +
    CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END +
    CASE WHEN COALESCE(linkedin_share_claimed, false) THEN 25 ELSE 0 END
  ) / 10);

-- Step 6: Re-enable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_waitlist_admin_action') THEN
    CREATE TRIGGER log_admin_action_trigger
    AFTER UPDATE ON meetings_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION log_waitlist_admin_action();
  END IF;
END $$;

-- Step 7: Add comment explaining the fix
COMMENT ON TRIGGER aa_set_signup_position_trigger ON meetings_waitlist IS 
  'Runs first (aa_ prefix) to ensure signup_position is set before effective_position is calculated';
















