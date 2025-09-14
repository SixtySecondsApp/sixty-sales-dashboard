-- Complete Google Tasks Setup
-- This script properly sets up your Google Task lists for syncing

-- First, check if sync status exists and create/update it
DO $$
BEGIN
  -- Check if entry exists
  IF NOT EXISTS (
    SELECT 1 FROM google_tasks_sync_status 
    WHERE user_id = auth.uid()
  ) THEN
    -- Create new entry with all required fields
    INSERT INTO google_tasks_sync_status (
      user_id,
      sync_state,
      last_full_sync_at,
      last_incremental_sync_at,
      tasks_synced_count,
      conflicts_count,
      created_at,
      updated_at
    )
    VALUES (
      auth.uid(),
      'idle',
      NOW(),  -- Set to now to avoid NULL issues
      NOW(),  -- Set to now to avoid NULL issues
      0,
      0,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Created sync status entry';
  ELSE
    -- Update existing entry
    UPDATE google_tasks_sync_status
    SET 
      sync_state = 'idle',
      updated_at = NOW()
    WHERE user_id = auth.uid();
    RAISE NOTICE 'Updated existing sync status entry';
  END IF;
END $$;

-- Create a default list configuration for all priorities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM google_tasks_list_configs 
    WHERE user_id = auth.uid() 
    AND google_list_id = '@default'
  ) THEN
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
      display_order,
      created_at,
      updated_at
    )
    VALUES (
      auth.uid(),
      '@default',  -- Google's default task list
      'My Tasks',
      'bidirectional',
      true,
      ARRAY['urgent', 'high', 'medium', 'low']::text[],  -- All priorities
      ARRAY[]::text[],
      ARRAY[]::text[],
      true,
      true,
      0,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Created default list configuration';
  ELSE
    RAISE NOTICE 'Default list configuration already exists';
  END IF;
END $$;

-- Verify the configuration was created
SELECT 
  'Your Google Task List Configurations:' as info,
  list_title,
  sync_direction,
  is_primary,
  sync_enabled,
  priority_filter
FROM google_tasks_list_configs
WHERE user_id = auth.uid();

-- Check sync status
SELECT 
  'Your Sync Status:' as info,
  sync_state,
  to_char(last_full_sync_at, 'MM/DD HH24:MI') as last_full_sync,
  to_char(last_incremental_sync_at, 'MM/DD HH24:MI') as last_incremental,
  tasks_synced_count,
  conflicts_count
FROM google_tasks_sync_status
WHERE user_id = auth.uid();

-- Update any pending tasks to ensure they're ready to sync
UPDATE tasks
SET 
  updated_at = NOW(),
  sync_status = 'pending_sync'
WHERE 
  assigned_to = auth.uid()
  AND (sync_status = 'local_only' OR sync_status = 'pending_sync')
  AND google_task_id IS NULL;

-- Show how many tasks are ready to sync
SELECT 
  'Tasks Ready to Sync:' as status,
  COUNT(*) as total_pending,
  COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tasks,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_tasks,
  COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_tasks,
  COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_tasks
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync';

-- Show a sample of tasks that will sync
SELECT 
  'Sample Tasks to Sync (first 5):' as info,
  title,
  priority,
  sync_status,
  to_char(created_at, 'MM/DD HH24:MI') as created
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
ORDER BY created_at DESC
LIMIT 5;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Google Tasks sync is now configured!';
  RAISE NOTICE '📋 Your tasks will sync to Google Tasks within 30 seconds.';
  RAISE NOTICE '🔄 The background sync will handle everything automatically.';
END $$;