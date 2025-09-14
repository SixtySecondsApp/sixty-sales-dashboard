-- Setup Google Tasks List Configuration
-- This script sets up your Google Task lists for syncing

-- First, check if the user has a sync status entry
INSERT INTO google_tasks_sync_status (
  user_id,
  sync_state,
  last_full_sync_at,
  tasks_synced_count
)
SELECT 
  auth.uid(),
  'idle',
  NULL,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM google_tasks_sync_status 
  WHERE user_id = auth.uid()
)
RETURNING 'Created sync status entry' as result;

-- Create a default list configuration for all priorities
-- This will sync all tasks to your primary Google Tasks list
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
SELECT
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
  0
WHERE NOT EXISTS (
  SELECT 1 FROM google_tasks_list_configs 
  WHERE user_id = auth.uid() 
  AND google_list_id = '@default'
)
RETURNING 'Created default list configuration' as result;

-- Optional: Create separate lists for different priorities
-- Uncomment if you want tasks to go to different lists based on priority

/*
-- High priority list
INSERT INTO google_tasks_list_configs (
  user_id,
  google_list_id,
  list_title,
  sync_direction,
  is_primary,
  priority_filter,
  auto_create_in_list,
  sync_enabled,
  display_order
)
SELECT
  auth.uid(),
  '@default',  -- Change this to a specific list ID if you have multiple lists
  'High Priority Tasks',
  'bidirectional',
  false,
  ARRAY['urgent', 'high']::text[],
  true,
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM google_tasks_list_configs 
  WHERE user_id = auth.uid() 
  AND list_title = 'High Priority Tasks'
);

-- Low priority list
INSERT INTO google_tasks_list_configs (
  user_id,
  google_list_id,
  list_title,
  sync_direction,
  is_primary,
  priority_filter,
  auto_create_in_list,
  sync_enabled,
  display_order
)
SELECT
  auth.uid(),
  '@default',  -- Change this to a specific list ID if you have multiple lists
  'Low Priority Tasks',
  'bidirectional',
  false,
  ARRAY['medium', 'low']::text[],
  true,
  true,
  2
WHERE NOT EXISTS (
  SELECT 1 FROM google_tasks_list_configs 
  WHERE user_id = auth.uid() 
  AND list_title = 'Low Priority Tasks'
);
*/

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

-- Now trigger a sync for all your pending tasks
-- Update any pending tasks to re-trigger sync
UPDATE tasks
SET 
  updated_at = NOW()
WHERE 
  assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
  AND google_task_id IS NULL
RETURNING 'Re-triggered sync for ' || COUNT(*) || ' pending tasks' as result;

-- Show summary
SELECT 
  'Setup Complete!' as status,
  'Your tasks will now sync to Google Tasks' as message,
  COUNT(*) as tasks_ready_to_sync
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync';