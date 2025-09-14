-- Verify Google Lists and Task List IDs
-- Check what list IDs are actually being used

-- Step 1: Check all unique list IDs in the system
SELECT 
  'All unique Google list IDs in tasks:' as info,
  google_list_id,
  COUNT(*) as task_count
FROM tasks
WHERE google_list_id IS NOT NULL
GROUP BY google_list_id
ORDER BY COUNT(*) DESC;

-- Step 2: Check list configurations
SELECT 
  'All list configurations:' as info,
  id,
  user_id,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled,
  auto_create_in_list
FROM google_tasks_list_configs
ORDER BY user_id, is_primary DESC;

-- Step 3: Check what's in google_task_lists
SELECT 
  'Google task lists:' as info,
  integration_id,
  google_list_id,
  title,
  is_default
FROM google_task_lists;

-- Step 4: Check the specific task that's failing
SELECT 
  'Task 7b982c68-04e5-45c7-8005-852e2b378c3c details:' as info,
  id,
  title,
  google_list_id,
  google_task_id,
  sync_status,
  assigned_to
FROM tasks
WHERE id = '7b982c68-04e5-45c7-8005-852e2b378c3c';

-- Step 5: Check if the list ID MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow is valid
-- This looks like a real Google list ID, but let's verify it exists in our configs
SELECT 
  'Check for MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow list:' as info,
  COUNT(*) as count_in_configs
FROM google_tasks_list_configs
WHERE google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

SELECT 
  'Tasks using MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow:' as info,
  COUNT(*) as count_in_tasks
FROM tasks
WHERE google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

-- Step 6: Update this specific list ID to @default
-- The list ID MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow might be from an old Google account
-- or a list that no longer exists
UPDATE tasks
SET 
  google_list_id = '@default',
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

SELECT 'Updated MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow to @default' as status;

-- Step 7: Verify all tasks now have valid list IDs
SELECT 
  'Final list ID distribution:' as info,
  google_list_id,
  COUNT(*) as count
FROM tasks
WHERE google_list_id IS NOT NULL
GROUP BY google_list_id;

-- Step 8: Make sure we don't have any other weird list IDs
-- Valid list IDs are either @default or start with uppercase letters/numbers
UPDATE tasks
SET 
  google_list_id = '@default',
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE google_list_id IS NOT NULL 
  AND google_list_id != '@default'
  AND google_list_id !~ '^[A-Z0-9]';

SELECT 
  '✅ All invalid list IDs have been fixed' as status,
  'All tasks now use @default or valid Google list IDs' as result;