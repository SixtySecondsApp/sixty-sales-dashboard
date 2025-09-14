-- Fix duplicate list configurations and invalid list IDs
-- Handle the unique constraint properly

-- Step 1: Check current list configurations for the user
SELECT 
  'Current list configs for user:' as info,
  id,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
ORDER BY is_primary DESC, created_at;

-- Step 2: Delete the config with the invalid list ID (MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow)
-- Since we already have a @default config, we just need to remove the invalid one
DELETE FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow';

SELECT 'Deleted invalid list config MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow' as status;

-- Step 3: Also delete any "Business" configs if they still exist
DELETE FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id = 'Business';

SELECT 'Deleted any Business list configs' as status;

-- Step 4: Make sure the @default config is primary and enabled
UPDATE google_tasks_list_configs
SET 
  is_primary = true,
  sync_enabled = true,
  sync_direction = 'bidirectional',
  auto_create_in_list = true,
  updated_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id = '@default';

SELECT 'Updated @default config to be primary and enabled' as status;

-- Step 5: Update all tasks with invalid list IDs to use @default
UPDATE tasks
SET 
  google_list_id = '@default',
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (
    google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow'
    OR google_list_id = 'Business'
    OR (google_list_id IS NOT NULL AND google_list_id != '@default' AND LENGTH(google_list_id) < 20)
  );

SELECT 'Updated all tasks with invalid list IDs to use @default' as status;

-- Step 6: Update google_task_mappings
UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (
    google_list_id = 'MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow'
    OR google_list_id = 'Business'
    OR (google_list_id IS NOT NULL AND google_list_id != '@default' AND LENGTH(google_list_id) < 20)
  );

SELECT 'Updated all task mappings with invalid list IDs' as status;

-- Step 7: Clean up google_task_lists table
DELETE FROM google_task_lists
WHERE google_list_id IN ('MDkwMTk5MDkxNjkzNTkzNDM2NzU6MDow', 'Business');

SELECT 'Cleaned up google_task_lists table' as status;

-- Step 8: Verify final state
SELECT 
  '=== Final List Configurations ===' as section,
  id,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled,
  auto_create_in_list
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

SELECT 
  '=== Task List ID Distribution ===' as section,
  google_list_id,
  COUNT(*) as task_count
FROM tasks
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id IS NOT NULL
GROUP BY google_list_id;

SELECT 
  '=== Specific Task Status ===' as section,
  id,
  title,
  google_list_id,
  sync_status
FROM tasks
WHERE id = '7b982c68-04e5-45c7-8005-852e2b378c3c';

-- Final message
SELECT 
  '✅ All duplicate configs removed' as status,
  'All tasks now use @default' as result,
  'Ready to sync again' as action;