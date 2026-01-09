-- Fix duplicate meeting activities
-- This migration:
-- 1. Removes duplicate activities for the same meeting (keeping the first one created)
-- 2. Adds a unique constraint to prevent future duplicates

-- Step 1: Delete duplicate activities, keeping the earliest created one
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY meeting_id, user_id, type
           ORDER BY created_at ASC, id ASC
         ) as rn
  FROM activities
  WHERE meeting_id IS NOT NULL
    AND type = 'meeting'
)
DELETE FROM activities
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 2: Create unique partial index (acts as a constraint)
-- This prevents inserting duplicate activities for the same meeting
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_meeting_user_type_unique
ON activities (meeting_id, user_id, type)
WHERE meeting_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_activities_meeting_user_type_unique IS
  'Prevents duplicate activities for the same meeting - one activity per (meeting_id, user_id, type) combination';
