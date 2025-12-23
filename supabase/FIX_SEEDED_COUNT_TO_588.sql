-- Fix seeded waitlist entries to exactly 588
-- This script removes excess seeded entries from the database

-- First, let's see current counts
SELECT
  COUNT(*) FILTER (WHERE is_seeded = true) as seeded_count,
  COUNT(*) FILTER (WHERE is_seeded = false OR is_seeded IS NULL) as real_count,
  COUNT(*) as total_count
FROM meetings_waitlist;

-- Step 1: Clear referral relationships for entries we're about to delete
-- This prevents foreign key constraint violations
WITH seeded_to_delete AS (
  SELECT id, referral_code
  FROM meetings_waitlist
  WHERE is_seeded = true
  ORDER BY created_at DESC
  OFFSET 588  -- Keep the first 588, delete the rest
)
UPDATE meetings_waitlist
SET referred_by_code = NULL
WHERE referred_by_code IN (SELECT referral_code FROM seeded_to_delete);

-- Step 2: Also clear referred_by_code on the entries we're deleting
-- (in case they reference entries we're keeping)
WITH seeded_to_delete AS (
  SELECT id
  FROM meetings_waitlist
  WHERE is_seeded = true
  ORDER BY created_at DESC
  OFFSET 588
)
UPDATE meetings_waitlist
SET referred_by_code = NULL
WHERE id IN (SELECT id FROM seeded_to_delete);

-- Step 3: Now safely delete the excess seeded entries
WITH seeded_to_delete AS (
  SELECT id
  FROM meetings_waitlist
  WHERE is_seeded = true
  ORDER BY created_at DESC
  OFFSET 588  -- Keep the first 588, delete the rest
)
DELETE FROM meetings_waitlist
WHERE id IN (SELECT id FROM seeded_to_delete);

-- Step 4: Recalculate referral counts for remaining entries
UPDATE meetings_waitlist mw
SET referral_count = (
  SELECT COUNT(*)
  FROM meetings_waitlist ref
  WHERE ref.referred_by_code = mw.referral_code
);

-- Step 5: Recalculate effective positions
UPDATE meetings_waitlist mw
SET effective_position = GREATEST(1, mw.signup_position - (mw.referral_count * 5));

-- Verify the new counts
SELECT
  COUNT(*) FILTER (WHERE is_seeded = true) as seeded_count,
  COUNT(*) FILTER (WHERE is_seeded = false OR is_seeded IS NULL) as real_count,
  COUNT(*) as total_count
FROM meetings_waitlist;
