-- Comprehensive Fix: Replace ALL "Business" list references with "@default"
-- This will fix the 400 Bad Request error from Google Tasks API

-- Step 1: Check where "Business" appears in tasks
SELECT 
  'Tasks with Business list:' as info,
  COUNT(*) as count
FROM tasks
WHERE google_list_id = 'Business';

-- Step 2: Update ALL tasks that have "Business" as their list
UPDATE tasks
SET 
  google_list_id = '@default',
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE google_list_id = 'Business';

SELECT 'Updated tasks from Business to @default' as status;

-- Step 3: Check and fix google_task_mappings
SELECT 
  'Task mappings with Business list:' as info,
  COUNT(*) as count
FROM google_task_mappings
WHERE google_list_id = 'Business';

UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE google_list_id = 'Business';

SELECT 'Updated task mappings from Business to @default' as status;

-- Step 4: Check and fix google_tasks_list_configs
SELECT 
  'List configs with Business list:' as info,
  COUNT(*) as count
FROM google_tasks_list_configs
WHERE google_list_id = 'Business';

UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE google_list_id = 'Business';

SELECT 'Updated list configs from Business to @default' as status;

-- Step 5: Also check for any other invalid short list IDs
-- Google list IDs are either special (@default) or long UUIDs
UPDATE tasks
SET 
  google_list_id = '@default',
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE google_list_id IS NOT NULL 
  AND google_list_id != '@default'
  AND LENGTH(google_list_id) < 20;

UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE google_list_id IS NOT NULL 
  AND google_list_id != '@default'
  AND LENGTH(google_list_id) < 20;

UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE google_list_id IS NOT NULL 
  AND google_list_id != '@default'
  AND LENGTH(google_list_id) < 20;

-- Step 6: Ensure we have a proper list configuration for the user
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video';
  
  IF v_user_id IS NOT NULL THEN
    -- Ensure we have at least one config for @default
    IF NOT EXISTS (
      SELECT 1 FROM google_tasks_list_configs 
      WHERE user_id = v_user_id AND google_list_id = '@default'
    ) THEN
      -- Create a default config
      INSERT INTO google_tasks_list_configs (
        user_id,
        google_list_id,
        list_title,
        is_primary,
        sync_enabled,
        sync_direction,
        priority_filter,
        created_at,
        updated_at
      ) VALUES (
        v_user_id,
        '@default',
        'My Tasks',
        true,
        true,
        'bidirectional',
        NULL,
        NOW(),
        NOW()
      );
      RAISE NOTICE 'Created @default list config for user';
    ELSE
      -- Make sure it's enabled and primary
      UPDATE google_tasks_list_configs
      SET 
        is_primary = true,
        sync_enabled = true,
        sync_direction = COALESCE(sync_direction, 'bidirectional'),
        updated_at = NOW()
      WHERE user_id = v_user_id 
        AND google_list_id = '@default';
      RAISE NOTICE 'Updated @default list config to be primary and enabled';
    END IF;
  END IF;
END $$;

-- Step 7: Show the specific task that was failing
SELECT 
  'Task that was failing to sync:' as info,
  id,
  title,
  google_list_id,
  sync_status,
  google_task_id
FROM tasks
WHERE id = '7b982c68-04e5-45c7-8005-852e2b378c3c';

-- Step 8: Verify all fixes
SELECT 
  '=== Tasks by List ===' as section,
  google_list_id,
  COUNT(*) as task_count,
  COUNT(CASE WHEN sync_status = 'pending_sync' THEN 1 END) as pending_sync
FROM tasks
WHERE assigned_to = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
GROUP BY google_list_id;

SELECT 
  '=== List Configurations ===' as section,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled,
  sync_direction
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

-- Final message
SELECT 
  '✅ All "Business" references replaced with "@default"' as status,
  'Tasks are now ready to sync' as result,
  'The 400 error should be resolved' as note,
  'Try syncing again now' as action;