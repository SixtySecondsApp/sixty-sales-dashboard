-- Complete Google Tasks Setup for andrew.bryce@sixtyseconds.video
-- This script will configure Google Tasks sync for your account

-- Step 1: Get your user ID
SELECT 
  'Finding your User ID...' as step,
  id as user_id,
  email
FROM auth.users
WHERE email = 'andrew.bryce@sixtyseconds.video'
LIMIT 1;

-- Step 2: Setup using subquery to get user ID automatically
DO $$
DECLARE
  v_user_id uuid;
  v_updated_count INTEGER;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for email: andrew.bryce@sixtyseconds.video';
  END IF;
  
  -- Create or update sync status
  INSERT INTO google_tasks_sync_status (
    user_id,
    sync_state,
    last_full_sync_at,
    last_incremental_sync_at,
    tasks_synced_count,
    conflicts_count
  )
  VALUES (
    v_user_id,
    'idle',
    NOW(),
    NOW(),
    0,
    0
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    sync_state = 'idle',
    updated_at = NOW();
  
  RAISE NOTICE '✅ Sync status configured for user %', v_user_id;
  
  -- Create default list configuration
  INSERT INTO google_tasks_list_configs (
    user_id,
    google_list_id,
    list_title,
    sync_direction,
    is_primary,
    priority_filter,
    task_categories,
    status_filter,
    auto_create_in_list,
    sync_enabled,
    display_order
  )
  VALUES (
    v_user_id,
    '@default',
    'My Tasks',
    'bidirectional',
    true,
    ARRAY['urgent', 'high', 'medium', 'low']::text[],
    ARRAY[]::text[],
    ARRAY[]::text[],
    true,
    true,
    0
  )
  ON CONFLICT (user_id, google_list_id)
  DO UPDATE SET
    sync_enabled = true,
    priority_filter = ARRAY['urgent', 'high', 'medium', 'low']::text[],
    is_primary = true,
    sync_direction = 'bidirectional',
    updated_at = NOW();
  
  RAISE NOTICE '✅ List configuration created/updated';
  
  -- Update tasks to be ready for sync
  UPDATE tasks
  SET 
    sync_status = 'pending_sync',
    updated_at = NOW()
  WHERE 
    assigned_to = v_user_id
    AND (sync_status = 'local_only' OR sync_status IS NULL)
    AND google_task_id IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Updated % tasks to pending_sync status', v_updated_count;
  
END $$;

-- Step 3: Verify the setup
WITH user_info AS (
  SELECT id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1
)
SELECT 
  'Sync Status Configured:' as status,
  s.sync_state,
  to_char(s.last_full_sync_at, 'MM/DD HH24:MI') as last_sync,
  s.tasks_synced_count
FROM google_tasks_sync_status s
JOIN user_info u ON s.user_id = u.id;

-- Check list configuration
WITH user_info AS (
  SELECT id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1
)
SELECT 
  'List Configuration:' as config,
  l.list_title,
  l.sync_enabled,
  l.is_primary,
  l.priority_filter
FROM google_tasks_list_configs l
JOIN user_info u ON l.user_id = u.id;

-- Check tasks ready to sync
WITH user_info AS (
  SELECT id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1
)
SELECT 
  'Tasks Ready to Sync:' as status,
  COUNT(*) as total_pending,
  COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent,
  COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high,
  COUNT(CASE WHEN t.priority = 'medium' THEN 1 END) as medium,
  COUNT(CASE WHEN t.priority = 'low' THEN 1 END) as low
FROM tasks t
JOIN user_info u ON t.assigned_to = u.id
WHERE t.sync_status = 'pending_sync';

-- Show sample of tasks that will sync
WITH user_info AS (
  SELECT id 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'
  LIMIT 1
)
SELECT 
  'Sample Tasks to Sync (first 5):' as info,
  t.title,
  t.priority,
  t.sync_status,
  to_char(t.created_at, 'MM/DD HH24:MI') as created
FROM tasks t
JOIN user_info u ON t.assigned_to = u.id
WHERE t.sync_status = 'pending_sync'
ORDER BY t.created_at DESC
LIMIT 5;

-- Final confirmation
SELECT 
  '🎉 Setup Complete!' as status,
  'Your tasks will now sync to Google Tasks automatically.' as message,
  'The background sync runs every 30 seconds.' as info;