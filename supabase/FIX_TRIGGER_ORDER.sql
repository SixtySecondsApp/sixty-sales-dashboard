-- ============================================
-- FIX TRIGGER ORDER - Run this in Supabase SQL Editor
-- ============================================
-- This fixes the bug where new signups get effective_position = 1 
-- instead of their actual signup_position

-- Step 1: Temporarily disable admin action logging (it requires auth.uid())
DROP TRIGGER IF EXISTS log_admin_action_trigger ON meetings_waitlist;

-- Step 2: Fix trigger order
DROP TRIGGER IF EXISTS set_signup_position_trigger ON meetings_waitlist;

CREATE TRIGGER aa_set_signup_position_trigger
BEFORE INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION set_signup_position();

-- Step 3: Drop the deprecated trigger
DROP TRIGGER IF EXISTS calculate_position_trigger ON meetings_waitlist;

-- Step 4: Fix existing broken entries
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

-- Step 5: Re-enable admin action logging trigger
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_waitlist_admin_action') THEN
    CREATE TRIGGER log_admin_action_trigger
    AFTER UPDATE ON meetings_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION log_waitlist_admin_action();
  END IF;
END $$;

-- Step 6: Verify the fix
SELECT 
  id,
  full_name,
  signup_position,
  effective_position,
  total_points,
  referral_count
FROM meetings_waitlist
ORDER BY effective_position ASC
LIMIT 20;





