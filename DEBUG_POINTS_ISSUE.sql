-- =====================================================
-- DEBUG POINTS NOT UPDATING ISSUE
-- =====================================================
-- Run this to see what's actually in the database

-- Check 1: What columns actually exist?
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
  AND column_name IN (
    'total_points',
    'linkedin_boost_claimed',
    'twitter_boost_claimed',
    'effective_position',
    'signup_position',
    'referral_count'
  )
ORDER BY column_name;

-- Check 2: Does the trigger exist?
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'calculate_points_trigger';

-- Check 3: What's the actual data for the most recent user (you)?
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
  linkedin_first_share_at,
  created_at,
  updated_at
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 5;

-- Check 4: Show the full leaderboard (top 20)
SELECT
  ROW_NUMBER() OVER (ORDER BY COALESCE(total_points, 0) DESC, created_at ASC) as position,
  id,
  full_name,
  email,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  COALESCE(total_points, 0) as total_points
FROM meetings_waitlist
ORDER BY COALESCE(total_points, 0) DESC, created_at ASC
LIMIT 20;

-- Check 5: Manually calculate what the points SHOULD be
SELECT
  full_name,
  email,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points as current_points,
  (COALESCE(referral_count, 0) * 5) +
  (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END) +
  (CASE WHEN twitter_boost_claimed THEN 50 ELSE 0 END) as calculated_points,
  signup_position,
  effective_position,
  GREATEST(1, signup_position - (
    (COALESCE(referral_count, 0) * 5) +
    (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END) +
    (CASE WHEN twitter_boost_claimed THEN 50 ELSE 0 END)
  )) as calculated_position
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 10;
