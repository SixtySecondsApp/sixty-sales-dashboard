-- Check Recent Tasks and Their Sync Status
-- This query shows your most recent tasks and their Google sync status

-- Get summary of task sync status
SELECT 
  'Task Sync Status Summary:' as info,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN sync_status = 'local_only' THEN 1 END) as local_only,
  COUNT(CASE WHEN sync_status = 'pending_sync' THEN 1 END) as pending_sync,
  COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced,
  COUNT(CASE WHEN google_task_id IS NOT NULL THEN 1 END) as has_google_id
FROM tasks
WHERE assigned_to = auth.uid();

-- Show your 10 most recent tasks with their sync details
SELECT 
  title,
  priority,
  sync_status,
  CASE 
    WHEN google_task_id IS NOT NULL THEN '✅ Has Google ID'
    ELSE '❌ No Google ID'
  END as google_sync,
  CASE
    WHEN sync_status = 'synced' THEN '🟢 Synced'
    WHEN sync_status = 'pending_sync' THEN '🟡 Pending'
    WHEN sync_status = 'local_only' THEN '🔴 Local Only'
    ELSE '⚪ Unknown'
  END as status_indicator,
  to_char(created_at, 'MM/DD HH24:MI') as created,
  to_char(last_synced_at, 'MM/DD HH24:MI') as last_synced,
  CASE 
    WHEN due_date IS NOT NULL THEN to_char(due_date, 'MM/DD')
    ELSE 'No due date'
  END as due,
  status as task_status
FROM tasks
WHERE assigned_to = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any tasks stuck in pending_sync for a long time
SELECT 
  'Tasks Stuck in Pending Sync (>1 hour old):' as info,
  COUNT(*) as stuck_tasks
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Show any stuck tasks (if any)
SELECT 
  id,
  title,
  sync_status,
  google_task_id,
  to_char(created_at, 'MM/DD HH24:MI') as created,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at))/60) as minutes_old
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at
LIMIT 5;

-- Check what columns exist in google_tasks_sync_status table
SELECT 
  'Google Tasks Sync Status Columns:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'google_tasks_sync_status'
ORDER BY ordinal_position;

-- Show your Google Tasks sync status (with available columns)
SELECT 
  'Your Google Tasks Sync Status:' as info,
  *
FROM google_tasks_sync_status
WHERE user_id = auth.uid();

-- Check if you have any Google Task list configurations
SELECT 
  'Google Task List Configurations:' as info,
  COUNT(*) as configured_lists
FROM google_tasks_list_configs
WHERE user_id = auth.uid();

-- Show your configured lists (if any)
SELECT 
  list_title,
  sync_direction,
  is_primary,
  sync_enabled,
  priority_filter,
  to_char(created_at, 'MM/DD HH24:MI') as created
FROM google_tasks_list_configs
WHERE user_id = auth.uid()
ORDER BY display_order, created_at;