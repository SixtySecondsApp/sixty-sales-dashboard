-- Fix google_task_lists table constraints
-- The app expects a unique constraint on (integration_id, google_list_id)

-- Step 1: Check current constraints on google_task_lists
SELECT 
  'Current constraints on google_task_lists:' as info,
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_lists'::regclass;

-- Step 2: Check if we have duplicate data that would prevent unique constraint
SELECT 
  'Check for duplicates:' as info,
  integration_id,
  google_list_id,
  COUNT(*) as count
FROM google_task_lists
WHERE integration_id IS NOT NULL
GROUP BY integration_id, google_list_id
HAVING COUNT(*) > 1;

-- Step 3: Remove any duplicates (keep the first one)
DELETE FROM google_task_lists a
USING google_task_lists b
WHERE a.id > b.id
  AND a.integration_id = b.integration_id
  AND a.google_list_id = b.google_list_id;

-- Step 4: Drop the existing unique constraint on google_list_id if it exists
ALTER TABLE google_task_lists 
DROP CONSTRAINT IF EXISTS google_task_lists_google_list_id_key;

-- Step 5: Add the composite unique constraint that the app expects
ALTER TABLE google_task_lists
ADD CONSTRAINT google_task_lists_integration_google_unique 
UNIQUE (integration_id, google_list_id);

SELECT 'Added unique constraint on (integration_id, google_list_id)' as status;

-- Step 6: Make sure integration_id can be NULL for backwards compatibility
ALTER TABLE google_task_lists 
ALTER COLUMN integration_id DROP NOT NULL;

-- Step 7: Verify the new constraint
SELECT 
  'New constraints on google_task_lists:' as info,
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_lists'::regclass
  AND contype = 'u'; -- unique constraints only

-- Step 8: Test that the table structure matches what the app expects
SELECT 
  'Table structure:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'google_task_lists'
ORDER BY ordinal_position;

-- Final confirmation
SELECT 
  '✅ Fixed google_task_lists constraints' as status,
  'The on_conflict clause should now work' as result;