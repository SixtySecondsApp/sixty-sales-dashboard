-- =====================================================
-- FORCE POINTS UPDATE - IMMEDIATE FIX
-- =====================================================
-- This manually forces the points calculation for all users
-- Run this RIGHT NOW to fix the issue immediately

-- Step 1: First check what we have
SELECT 'BEFORE UPDATE - Current State' as status;
SELECT
  full_name,
  email,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Manually calculate and update total_points for ALL users
UPDATE meetings_waitlist
SET
  total_points = (
    (COALESCE(referral_count, 0) * 5) +
    (CASE WHEN COALESCE(linkedin_boost_claimed, false) THEN 50 ELSE 0 END) +
    (CASE WHEN COALESCE(twitter_boost_claimed, false) THEN 50 ELSE 0 END)
  ),
  updated_at = NOW()
WHERE true; -- Update ALL rows

-- Step 3: Manually calculate and update effective_position for ALL users
UPDATE meetings_waitlist
SET
  effective_position = GREATEST(1, signup_position - COALESCE(total_points, 0)),
  updated_at = NOW()
WHERE true; -- Update ALL rows

-- Step 4: Verify the update worked
SELECT 'AFTER UPDATE - New State' as status;
SELECT
  full_name,
  email,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  total_points,
  (COALESCE(referral_count, 0) * 5) +
  (CASE WHEN linkedin_boost_claimed THEN 50 ELSE 0 END) +
  (CASE WHEN twitter_boost_claimed THEN 50 ELSE 0 END) as calculated_should_be
FROM meetings_waitlist
ORDER BY created_at DESC
LIMIT 10;

-- Step 5: Show the leaderboard
SELECT 'LEADERBOARD - Top 10' as status;
SELECT
  ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) as rank,
  full_name,
  total_points,
  referral_count,
  (CASE WHEN linkedin_boost_claimed THEN 1 ELSE 0 END) +
  (CASE WHEN twitter_boost_claimed THEN 1 ELSE 0 END) as shares,
  effective_position
FROM meetings_waitlist
ORDER BY total_points DESC, created_at ASC
LIMIT 10;

-- Step 6: Find the user who just shared (Satinder)
SELECT 'YOUR ACCOUNT' as status;
SELECT
  full_name,
  email,
  total_points,
  referral_count,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  effective_position,
  signup_position
FROM meetings_waitlist
WHERE full_name ILIKE '%satinder%'
   OR full_name ILIKE '%satin%'
ORDER BY created_at DESC
LIMIT 3;
