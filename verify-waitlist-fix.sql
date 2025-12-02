-- =============================================================================
-- Waitlist Points & Position Fix - Verification Script
-- =============================================================================
-- Run this script in Supabase SQL Editor after applying the three migrations
-- to verify that everything is working correctly.
-- =============================================================================

-- 1. CHECK: Verify all required columns exist
-- Expected: Should return 8 rows (one for each gamification column)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
  AND column_name IN (
    'total_points',
    'linkedin_boost_claimed',
    'twitter_boost_claimed',
    'linkedin_share_claimed',
    'linkedin_first_share_at',
    'effective_position',
    'signup_position',
    'is_seeded'
  )
ORDER BY column_name;

-- Expected Output:
-- effective_position | integer | YES | NULL
-- is_seeded | boolean | NO | false
-- linkedin_boost_claimed | boolean | YES | NULL
-- linkedin_first_share_at | timestamp with time zone | YES | NULL
-- linkedin_share_claimed | boolean | YES | NULL
-- signup_position | integer | YES | NULL
-- total_points | integer | NO | 0
-- twitter_boost_claimed | boolean | YES | NULL

-- =============================================================================

-- 2. CHECK: Verify waitlist_with_rank view exists and has display_rank column
-- Expected: Should return the view definition
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'waitlist_with_rank';

-- Expected Output:
-- public | waitlist_with_rank | SELECT ..., ROW_NUMBER() OVER ... AS display_rank ...

-- =============================================================================

-- 3. CHECK: Verify calculate_waitlist_points function exists
-- Expected: Should return 1 row with function details
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'calculate_waitlist_points';

-- Expected Output:
-- calculate_waitlist_points | FUNCTION | trigger

-- =============================================================================

-- 4. CHECK: Verify point calculation trigger exists
-- Expected: Should return 1 row with trigger details
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'calculate_points_trigger';

-- Expected Output:
-- calculate_points_trigger | INSERT | meetings_waitlist | EXECUTE FUNCTION ...
-- calculate_points_trigger | UPDATE | meetings_waitlist | EXECUTE FUNCTION ...

-- =============================================================================

-- 5. CHECK: Verify users have correct point calculations
-- Expected: All users should have total_points calculated correctly
-- Formula: (referral_count × 50) + boosts + position_bonus
SELECT
  full_name,
  referral_count,
  COALESCE(referral_count, 0) * 50 AS expected_base_points,
  CASE WHEN linkedin_boost_claimed THEN 100 ELSE 0 END AS linkedin_bonus,
  CASE WHEN twitter_boost_claimed THEN 100 ELSE 0 END AS twitter_bonus,
  CASE WHEN linkedin_share_claimed THEN 25 ELSE 0 END AS share_bonus,
  CASE
    WHEN effective_position <= 10 THEN 500
    WHEN effective_position <= 50 THEN 200
    WHEN effective_position <= 100 THEN 100
    ELSE 0
  END AS position_bonus,
  total_points AS actual_points,
  -- Calculated expected total
  (COALESCE(referral_count, 0) * 50) +
  CASE WHEN linkedin_boost_claimed THEN 100 ELSE 0 END +
  CASE WHEN twitter_boost_claimed THEN 100 ELSE 0 END +
  CASE WHEN linkedin_share_claimed THEN 25 ELSE 0 END +
  CASE
    WHEN effective_position <= 10 THEN 500
    WHEN effective_position <= 50 THEN 200
    WHEN effective_position <= 100 THEN 100
    ELSE 0
  END AS expected_total_points,
  -- Check if they match
  total_points = (
    (COALESCE(referral_count, 0) * 50) +
    CASE WHEN linkedin_boost_claimed THEN 100 ELSE 0 END +
    CASE WHEN twitter_boost_claimed THEN 100 ELSE 0 END +
    CASE WHEN linkedin_share_claimed THEN 25 ELSE 0 END +
    CASE
      WHEN effective_position <= 10 THEN 500
      WHEN effective_position <= 50 THEN 200
      WHEN effective_position <= 100 THEN 100
      ELSE 0
    END
  ) AS points_correct
FROM meetings_waitlist
ORDER BY referral_count DESC, total_points DESC
LIMIT 20;

-- Expected Output:
-- All rows should have points_correct = TRUE
-- Users with referrals should have significant points (50+ per referral)
-- Margaret Adams (2 referrals) should show ~100-700 points depending on position/boosts

-- =============================================================================

-- 6. CHECK: Verify display_rank is unique and sequential
-- Expected: Should return 0 rows (no duplicate display_ranks)
SELECT
  display_rank,
  COUNT(*) as count
FROM waitlist_with_rank
GROUP BY display_rank
HAVING COUNT(*) > 1;

-- Expected Output:
-- (empty result set - no duplicates)

-- =============================================================================

-- 7. CHECK: Verify position ties are broken by created_at
-- Expected: Users with same effective_position should have sequential display_ranks
SELECT
  effective_position,
  display_rank,
  full_name,
  created_at,
  referral_count,
  total_points
FROM waitlist_with_rank
WHERE effective_position IN (
  -- Find positions that have multiple users
  SELECT effective_position
  FROM waitlist_with_rank
  GROUP BY effective_position
  HAVING COUNT(*) > 1
)
ORDER BY effective_position ASC, created_at ASC;

-- Expected Output:
-- Users with same effective_position should have sequential display_ranks
-- Earlier created_at should have lower display_rank

-- =============================================================================

-- 8. CHECK: Top 20 users by display_rank
-- This is what the admin table will show
SELECT
  display_rank,
  effective_position,
  full_name,
  email,
  referral_count,
  total_points,
  is_seeded,
  created_at
FROM waitlist_with_rank
ORDER BY display_rank ASC
LIMIT 20;

-- Expected Output:
-- Sequential display_rank (1, 2, 3, 4, ...)
-- No duplicate display_ranks
-- Proper point calculations
-- Seeded users clearly marked

-- =============================================================================

-- 9. CHECK: Top 10 users by total_points (Leaderboard)
-- This is what the public leaderboard will show
SELECT
  ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) as leaderboard_rank,
  full_name,
  effective_position,
  display_rank,
  referral_count,
  total_points,
  linkedin_boost_claimed,
  twitter_boost_claimed
FROM waitlist_with_rank
ORDER BY total_points DESC, created_at ASC
LIMIT 10;

-- Expected Output:
-- Users ordered by points (highest first)
-- Top users should have significant points
-- Points should reflect referrals + boosts + position bonuses

-- =============================================================================

-- 10. SUMMARY: Overall Statistics
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_seeded) as seeded_users,
  COUNT(*) FILTER (WHERE NOT is_seeded) as real_users,
  AVG(total_points) as avg_points,
  MAX(total_points) as max_points,
  MIN(total_points) as min_points,
  AVG(referral_count) as avg_referrals,
  MAX(referral_count) as max_referrals,
  COUNT(*) FILTER (WHERE total_points > 0) as users_with_points,
  COUNT(*) FILTER (WHERE referral_count > 0) as users_with_referrals,
  COUNT(*) FILTER (WHERE linkedin_boost_claimed) as linkedin_boosts,
  COUNT(*) FILTER (WHERE twitter_boost_claimed) as twitter_boosts
FROM meetings_waitlist;

-- Expected Output:
-- Reasonable statistics showing:
-- - Mix of seeded and real users
-- - Average points > 0
-- - Users with points > 0
-- - Some users have referrals and boosts

-- =============================================================================
-- END OF VERIFICATION SCRIPT
-- =============================================================================

-- ✅ If all checks pass, the migrations were successful!
-- ✅ Admin table will show proper position ranking with display_rank
-- ✅ Public waitlist will show correct position and points
-- ✅ Leaderboard will rank users by points correctly
-- ✅ Real-time updates will work for position and point changes

-- ❌ If any checks fail, review the WAITLIST_MIGRATION_GUIDE.md troubleshooting section
