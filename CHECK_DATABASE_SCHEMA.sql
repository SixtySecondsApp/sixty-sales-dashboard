-- =====================================================
-- CHECK DATABASE SCHEMA FOR POINTS SYSTEM
-- =====================================================
-- Run this in Supabase SQL Editor to check if points system is set up

-- Check if columns exist
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
  AND column_name IN (
    'total_points',
    'linkedin_boost_claimed',
    'twitter_boost_claimed',
    'linkedin_first_share_at',
    'twitter_first_share_at'
  )
ORDER BY column_name;

-- Check if trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'calculate_points_trigger';

-- Check current data for the user who just shared
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
ORDER BY created_at DESC
LIMIT 5;
