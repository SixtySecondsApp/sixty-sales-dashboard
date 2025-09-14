-- Add database constraints to prevent duplicate Google tasks
-- This will ensure Google task IDs are unique per user

-- Step 1: Check current constraints on tasks table
SELECT 
  'Current constraints on tasks table:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype = 'u'; -- unique constraints

-- Step 2: Check for existing duplicates before adding constraint
SELECT 
  'Duplicate Google task IDs:' as info,
  google_task_id,
  assigned_to,
  COUNT(*) as duplicate_count,
  array_agg(id) as task_ids
FROM tasks
WHERE google_task_id IS NOT NULL
GROUP BY google_task_id, assigned_to
HAVING COUNT(*) > 1;

-- Step 3: Clean up any existing duplicates (keep the most recent)
-- This will delete older duplicates based on created_at timestamp
DELETE FROM tasks a
USING tasks b
WHERE a.google_task_id = b.google_task_id
  AND a.assigned_to = b.assigned_to
  AND a.google_task_id IS NOT NULL
  AND a.created_at < b.created_at; -- Keep the newer one

SELECT 'Cleaned up duplicate tasks' as status;

-- Step 4: Add unique constraint to prevent future duplicates
-- This ensures one task per Google task ID per user
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_google_task_id_user_unique;

ALTER TABLE tasks
ADD CONSTRAINT tasks_google_task_id_user_unique 
UNIQUE (google_task_id, assigned_to);

SELECT 'Added unique constraint for Google task IDs per user' as status;

-- Step 5: Also ensure google_task_mappings has proper constraints
-- Check current mappings duplicates
SELECT 
  'Duplicate mappings:' as info,
  google_task_id,
  user_id,
  COUNT(*) as duplicate_count
FROM google_task_mappings
WHERE google_task_id IS NOT NULL
GROUP BY google_task_id, user_id
HAVING COUNT(*) > 1;

-- Clean up mapping duplicates (keep most recent)
DELETE FROM google_task_mappings a
USING google_task_mappings b
WHERE a.google_task_id = b.google_task_id
  AND a.user_id = b.user_id
  AND a.google_task_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Add unique constraint for mappings
ALTER TABLE google_task_mappings
DROP CONSTRAINT IF EXISTS google_task_mappings_google_task_user_unique;

ALTER TABLE google_task_mappings
ADD CONSTRAINT google_task_mappings_google_task_user_unique 
UNIQUE (google_task_id, user_id);

SELECT 'Added unique constraint for Google task mappings per user' as status;

-- Step 6: Create an index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_google_task_id_assigned_to 
ON tasks(google_task_id, assigned_to) 
WHERE google_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_google_task_mappings_google_task_user 
ON google_task_mappings(google_task_id, user_id) 
WHERE google_task_id IS NOT NULL;

-- Step 7: Verify the constraints are in place
SELECT 
  'Final constraints on tasks:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype = 'u'
  AND conname LIKE '%google_task%';

SELECT 
  'Final constraints on google_task_mappings:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_mappings'::regclass
  AND contype = 'u'
  AND conname LIKE '%google_task%';

-- Final status
SELECT 
  '✅ Database constraints added to prevent duplicates' as status,
  'Google task IDs are now unique per user' as result,
  'Sync will no longer create duplicate tasks' as note;