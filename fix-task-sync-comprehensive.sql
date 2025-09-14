-- Comprehensive Fix for Task Sync Status
-- This script fixes the issue where tasks are created with 'local_only' status
-- preventing them from syncing to Google Tasks

-- Step 1: Check current state
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING CURRENT STATE ===';
END $$;

SELECT 
  'Current Task Status Distribution:' as info,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN sync_status = 'local_only' THEN 1 END) as local_only_tasks,
  COUNT(CASE WHEN sync_status = 'pending_sync' THEN 1 END) as pending_sync_tasks,
  COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced_tasks,
  COUNT(CASE WHEN google_task_id IS NOT NULL THEN 1 END) as has_google_id
FROM tasks
WHERE assigned_to = auth.uid();

-- Step 2: Show sample of tasks that will be updated
DO $$
BEGIN
  RAISE NOTICE '=== TASKS THAT WILL BE UPDATED ===';
END $$;

SELECT 
  id,
  title,
  priority,
  sync_status,
  google_task_id,
  created_at::date as created_date
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'local_only'
  AND google_task_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Update existing local_only tasks to pending_sync
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE tasks
  SET 
    sync_status = 'pending_sync',
    updated_at = NOW()
  WHERE 
    assigned_to = auth.uid()
    AND sync_status = 'local_only'
    AND google_task_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Updated % tasks from local_only to pending_sync', updated_count;
END $$;

-- Step 4: Check current column default
DO $$
DECLARE
  current_default TEXT;
BEGIN
  SELECT column_default INTO current_default
  FROM information_schema.columns
  WHERE table_name = 'tasks' 
  AND column_name = 'sync_status';
  
  RAISE NOTICE 'Current default for sync_status: %', current_default;
END $$;

-- Step 5: Change the default for future tasks
DO $$
BEGIN
  ALTER TABLE tasks 
  ALTER COLUMN sync_status SET DEFAULT 'pending_sync';
  RAISE NOTICE '✅ Changed default sync_status to pending_sync for all future tasks';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not change default: %', SQLERRM;
END $$;

-- Step 6: Verify the changes
DO $$
BEGIN
  RAISE NOTICE '=== VERIFICATION ===';
END $$;

-- Show updated task distribution
SELECT 
  'Updated Task Status Distribution:' as info,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN sync_status = 'local_only' THEN 1 END) as local_only_remaining,
  COUNT(CASE WHEN sync_status = 'pending_sync' THEN 1 END) as pending_sync_tasks,
  COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as synced_tasks
FROM tasks
WHERE assigned_to = auth.uid();

-- Show sample of updated tasks
SELECT 
  'Sample of Updated Tasks:' as info,
  id,
  title,
  sync_status,
  updated_at
FROM tasks
WHERE assigned_to = auth.uid()
  AND sync_status = 'pending_sync'
  AND updated_at >= NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC
LIMIT 5;

-- Verify the new default
SELECT 
  'New Column Default:' as info,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks' 
AND column_name = 'sync_status';

-- Step 7: Create a function to ensure new tasks get proper sync status
CREATE OR REPLACE FUNCTION ensure_task_sync_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If sync_status is not set or is 'local_only', set it to 'pending_sync'
  IF NEW.sync_status IS NULL OR NEW.sync_status = 'local_only' THEN
    NEW.sync_status = 'pending_sync';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS ensure_task_sync_status_trigger ON tasks;
CREATE TRIGGER ensure_task_sync_status_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION ensure_task_sync_status();

DO $$
BEGIN
  RAISE NOTICE '✅ Created trigger to ensure all new tasks get pending_sync status';
  RAISE NOTICE '';
  RAISE NOTICE '=== SYNC FIX COMPLETE ===';
  RAISE NOTICE 'All existing local_only tasks have been updated to pending_sync.';
  RAISE NOTICE 'All future tasks will be created with pending_sync status.';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Next step: Click "Sync with Google" on the Tasks page to sync your tasks!';
END $$;