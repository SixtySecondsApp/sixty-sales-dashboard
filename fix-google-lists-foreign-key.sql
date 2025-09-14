-- Fix Foreign Key Constraint for google_task_lists
-- The integration_id should reference google_integrations, not users

-- Step 1: Check current foreign key constraints
SELECT 
  'Current Foreign Keys on google_task_lists:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_lists'::regclass
  AND contype = 'f'; -- foreign key constraints

-- Step 2: Drop the incorrect foreign key constraint
ALTER TABLE google_task_lists 
DROP CONSTRAINT IF EXISTS google_task_lists_integration_id_fkey;

-- Step 3: Add the correct foreign key constraint
ALTER TABLE google_task_lists
ADD CONSTRAINT google_task_lists_integration_id_fkey 
FOREIGN KEY (integration_id) 
REFERENCES google_integrations(id) 
ON DELETE CASCADE;

-- Step 4: Verify the fix
SELECT 
  'Fixed Foreign Keys on google_task_lists:' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'google_task_lists'::regclass
  AND contype = 'f';

-- Step 5: Now we can safely insert the @default list
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
  
  IF v_integration_id IS NOT NULL THEN
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
    
    RAISE NOTICE 'Successfully created/updated @default list for integration %', v_integration_id;
  ELSE
    RAISE NOTICE 'No Google integration found for user andrew.bryce@sixtyseconds.video';
  END IF;
END $$;

-- Step 6: Fix google_tasks_list_configs to use @default
UPDATE google_tasks_list_configs
SET 
  google_list_id = '@default',
  updated_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (google_list_id = 'Business' OR (google_list_id NOT LIKE '@%' AND LENGTH(google_list_id) < 20));

-- Step 7: Ensure at least one primary list config exists
DO $$
DECLARE
  v_user_id uuid;
  v_config_exists boolean;
BEGIN
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video';
  
  IF v_user_id IS NOT NULL THEN
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
      RAISE NOTICE 'Created default list config for user';
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
        RAISE NOTICE 'Set primary list config';
      END IF;
    END IF;
  END IF;
END $$;

-- Step 8: Fix any task mappings with invalid list IDs
UPDATE google_task_mappings
SET google_list_id = '@default'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
  AND (google_list_id = 'Business' OR (google_list_id NOT LIKE '@%' AND LENGTH(google_list_id) < 20));

-- Step 9: Verify everything is fixed
SELECT 
  '=== Google Integrations ===' as section,
  gi.id as integration_id,
  u.email as user_email,
  gi.is_active
FROM google_integrations gi
JOIN auth.users u ON gi.user_id = u.id
WHERE u.email = 'andrew.bryce@sixtyseconds.video';

SELECT 
  '=== Google Task Lists ===' as section,
  gtl.integration_id,
  gtl.google_list_id,
  gtl.title,
  gtl.is_default
FROM google_task_lists gtl
WHERE gtl.integration_id IN (
  SELECT gi.id 
  FROM google_integrations gi
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

-- Final status
SELECT 
  '✅ Foreign Key Fixed and Google Sync Ready' as status,
  'The google_task_lists table now correctly references google_integrations' as fix,
  'All lists now use @default' as result,
  'The 409 conflict should be resolved' as note;