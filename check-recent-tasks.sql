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

-- Show any stuck tasks
SELECT 
  id,
  title,
  sync_status,
  google_task_id,
  to_char(created_at, 'MM/DD HH24:MI') as created,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_old
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at
LIMIT 5;

-- Check your Google Tasks sync connection status
SELECT 
  'Google Tasks Connection:' as info,
  is_connected,
  to_char(last_full_sync_at, 'MM/DD HH24:MI') as last_full_sync,
  to_char(last_incremental_sync_at, 'MM/DD HH24:MI') as last_incremental_sync,
  tasks_synced_count,
  sync_state
FROM google_tasks_sync_status
WHERE user_id = auth.uid();