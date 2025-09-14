-- Fix Task Sync Status
-- This will update all local_only tasks to pending_sync so they can be synced to Google

-- First, let's see how many tasks need updating
SELECT 
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN sync_status = 'local_only' THEN 1 END) as local_only_tasks,
  COUNT(CASE WHEN sync_status = 'pending_sync' THEN 1 END) as pending_sync_tasks,
  COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced_tasks
FROM tasks
WHERE assigned_to = auth.uid();

-- Update all local_only tasks to pending_sync so they will sync to Google
UPDATE tasks
SET 
  sync_status = 'pending_sync',
  updated_at = NOW()
WHERE 
  assigned_to = auth.uid()
  AND sync_status = 'local_only'
  AND google_task_id IS NULL;  -- Only update tasks that haven't been synced before

-- Check the results
SELECT 
  id,
  title,
  priority,
  sync_status,
  google_task_id,
  created_at
FROM tasks
WHERE assigned_to = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- Also, let's change the default for future tasks
-- This will make new tasks automatically sync
ALTER TABLE tasks 
ALTER COLUMN sync_status SET DEFAULT 'pending_sync';

-- Verify the default was changed
SELECT 
  column_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks' 
AND column_name = 'sync_status';