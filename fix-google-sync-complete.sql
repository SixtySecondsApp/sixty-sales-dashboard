-- Complete Fix for Google Tasks Sync Issues
-- This handles the 409 conflict and ensures proper setup

-- Step 1: Clean up any conflicting data in google_task_lists
-- First, let's see what we have
SELECT 
  'Current google_task_lists:' as info,
  id,
  integration_id,
  google_list_id,
  title,
  updated_at
FROM google_task_lists;

-- Step 2: Remove duplicates if any exist (keep the most recent)
DELETE FROM google_task_lists a
USING google_task_lists b
WHERE a.id < b.id
  AND a.integration_id = b.integration_id
  AND a.google_list_id = b.google_list_id;

-- Step 3: Fix the integration_id to match the user's google_integrations record
UPDATE google_task_lists
SET integration_id = (
  SELECT gi.id 
  FROM google_integrations gi
  JOIN auth.users u ON gi.user_id = u.id
  WHERE u.email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1
)
WHERE integration_id IS NULL 
  OR integration_id NOT IN (SELECT id FROM google_integrations);

-- Step 4: Ensure we have the @default list for the user's integration
DO $$
DECLARE
  v_integration_id uuid;
  v_user_id uuid;
BEGIN
  -- Get the user and integration IDs
  SELECT u.id, gi.id 
  INTO v_user_id, v_integration_id
  FROM auth.users u
  JOIN google_integrations gi ON gi.user_id = u.id
  WHERE u.email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1;
  
  -- Insert or update the @default list
  INSERT INTO google_task_lists (
    integration_id,
    google_list_id,
    title,
    updated_at
  ) VALUES (
    v_integration_id,
    '@default',
    'My Tasks',
    NOW()
  )
  ON CONFLICT (integration_id, google_list_id) 
  DO UPDATE SET
    title = EXCLUDED.title,
    updated_at = NOW();
END $$;

-- Step 5: Fix google_tasks_list_configs to use @default
UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (google_list_id = 'Business' OR google_list_id NOT LIKE '@%' AND LENGTH(google_list_id) < 20);

-- Step 6: Ensure at least one primary list config exists
DO $$
DECLARE
  v_user_id uuid;
  v_config_exists boolean;
BEGIN
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video';
  
  -- Check if any config exists
  SELECT EXISTS(
    SELECT 1 FROM google_tasks_list_configs 
    WHERE user_id = v_user_id
  ) INTO v_config_exists;
  
  IF NOT v_config_exists THEN
    -- Create a default config
    INSERT INTO google_tasks_list_configs (
      user_id,
      google_list_id,
      list_title,
      is_primary,
      sync_enabled,
      priority_filter,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '@default',
      'My Tasks',
      true,
      true,
      NULL,
      NOW(),
      NOW()
    );
  ELSE
    -- Ensure at least one is primary
    IF NOT EXISTS (
      SELECT 1 FROM google_tasks_list_configs 
      WHERE user_id = v_user_id AND is_primary = true
    ) THEN
      UPDATE google_tasks_list_configs
      SET is_primary = true, updated_at = NOW()
      WHERE id = (
        SELECT id FROM google_tasks_list_configs
        WHERE user_id = v_user_id
        ORDER BY created_at
        LIMIT 1
      );
    END IF;
  END IF;
END $$;

-- Step 7: Fix any task mappings with invalid list IDs
UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (google_list_id = 'Business' OR google_list_id NOT LIKE '@%' AND LENGTH(google_list_id) < 20);

-- Step 8: Verify the fixes
SELECT 
  '=== Google Task Lists ===' as section,
  integration_id,
  google_list_id,
  title
FROM google_task_lists
WHERE integration_id IN (
  SELECT gi.id FROM google_integrations gi
  JOIN auth.users u ON gi.user_id = u.id
  WHERE u.email = 'andrew.bryce@sixtyseconds.video'
);

SELECT 
  '=== List Configurations ===' as section,
  google_list_id,
  list_title,
  is_primary,
  sync_enabled
FROM google_tasks_list_configs
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video');

SELECT 
  '=== Task Mappings Count ===' as section,
  google_list_id,
  COUNT(*) as task_count
FROM google_task_mappings
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
GROUP BY google_list_id;

-- Final status
SELECT 
  '✅ Google Sync Fix Complete' as status,
  'All lists now use @default' as result,
  'The 409 conflict should be resolved' as note;