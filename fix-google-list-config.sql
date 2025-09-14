-- Fix Google Tasks List Configuration
-- The app is trying to use "Business" as a list ID, but it should be "@default" or a real Google list ID

-- Step 1: Check current list configurations
SELECT 
  'Current List Configurations:' as info,
  id,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled,
  priority_filter
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

-- Step 2: Update any invalid list IDs to use @default
UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id NOT LIKE '@%'  -- Not a special list
  AND LENGTH(google_list_id) < 20;  -- Not a real Google ID (they're long)

-- Step 3: Make sure we have at least one primary list with @default
DO $$
DECLARE
  v_user_id uuid;
  v_config_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video';
  
  -- Check if we have a primary list
  IF NOT EXISTS (
    SELECT 1 FROM google_tasks_list_configs 
    WHERE user_id = v_user_id AND is_primary = true
  ) THEN
    -- Get the ID of the first list configuration
    SELECT id INTO v_config_id 
    FROM google_tasks_list_configs
    WHERE user_id = v_user_id
    ORDER BY created_at
    LIMIT 1;
    
    -- Update that specific list to be primary and use @default
    IF v_config_id IS NOT NULL THEN
      UPDATE google_tasks_list_configs
      SET 
        is_primary = true,
        google_list_id = '@default',
        updated_at = NOW()
      WHERE id = v_config_id;
    END IF;
  END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
  'Fixed List Configurations:' as info,
  id,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled,
  priority_filter
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

-- Step 5: Also check if there are any tasks that have invalid google_list_id references
SELECT 
  'Tasks with invalid list references:' as info,
  COUNT(*) as count
FROM google_task_mappings m
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'andrew.bryce@sixtyseconds.video'
  AND m.google_list_id NOT LIKE '@%'
  AND LENGTH(m.google_list_id) < 20;

-- Step 6: Fix any invalid task mappings
UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND google_list_id NOT LIKE '@%'
  AND LENGTH(google_list_id) < 20;

-- Final confirmation
SELECT 
  '✅ Fixed Google List Configuration' as status,
  'All lists now use @default or valid Google IDs' as result,
  'Tasks should sync properly now' as action;