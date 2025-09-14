-- Complete Google Tasks Setup with User ID
-- Run this script while logged into your Supabase dashboard

-- First, find your user ID
SELECT 
  'Your User ID:' as info,
  id as user_id,
  email
FROM auth.users
WHERE email = 'your-email@example.com';  -- REPLACE WITH YOUR EMAIL

-- IMPORTANT: Copy your user ID from above and replace in the queries below
-- Replace 'YOUR-USER-ID-HERE' with your actual UUID

-- Setup sync status for your user
INSERT INTO google_tasks_sync_status (
  user_id,
  sync_state,
  last_full_sync_at,
  last_incremental_sync_at,
  tasks_synced_count,
  conflicts_count
)
VALUES (
  'YOUR-USER-ID-HERE'::uuid,  -- REPLACE WITH YOUR USER ID
  'idle',
  NOW(),
  NOW(),
  0,
  0
)
ON CONFLICT (user_id) 
DO UPDATE SET
  sync_state = 'idle',
  updated_at = NOW()
RETURNING 'Sync status configured' as result;

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
  'YOUR-USER-ID-HERE'::uuid,  -- REPLACE WITH YOUR USER ID
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
  updated_at = NOW()
RETURNING 'List configuration created/updated' as result;

-- Update your tasks to be ready for sync
UPDATE tasks
SET 
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE 
  assigned_to = 'YOUR-USER-ID-HERE'::uuid  -- REPLACE WITH YOUR USER ID
  AND (sync_status = 'local_only' OR sync_status IS NULL)
  AND google_task_id IS NULL;

-- Verify setup
SELECT 
  'Setup Complete - Your Configuration:' as info;

SELECT 
  'Sync Status:' as info,
  sync_state,
  to_char(last_full_sync_at, 'MM/DD HH24:MI') as last_sync
FROM google_tasks_sync_status
WHERE user_id = 'YOUR-USER-ID-HERE'::uuid;  -- REPLACE WITH YOUR USER ID

SELECT 
  'List Configuration:' as info,
  list_title,
  sync_enabled,
  priority_filter
FROM google_tasks_list_configs
WHERE user_id = 'YOUR-USER-ID-HERE'::uuid;  -- REPLACE WITH YOUR USER ID

SELECT 
  'Tasks Ready to Sync:' as info,
  COUNT(*) as total_pending
FROM tasks
WHERE assigned_to = 'YOUR-USER-ID-HERE'::uuid  -- REPLACE WITH YOUR USER ID
  AND sync_status = 'pending_sync';