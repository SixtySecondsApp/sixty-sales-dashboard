-- =====================================================
-- CHECK CURRENT DATA FOR JESSICA
-- =====================================================
-- Run this to see what's actually in the database

-- Find Jessica's account
SELECT
  id,
  email,
  full_name,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  created_at
FROM meetings_waitlist
WHERE full_name ILIKE '%jessica%'
ORDER BY created_at DESC;

-- Check if the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'calculate_points_trigger'
  AND event_object_table = 'meetings_waitlist';

-- Check if columns exist
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
  AND column_name IN ('total_points', 'effective_position', 'linkedin_boost_claimed', 'twitter_boost_claimed')
ORDER BY column_name;
