-- Cleanup Script: Remove Auto-Synced Fathom Tasks
-- Purpose: Remove tasks that were automatically created from Fathom meeting action items
-- Date: 2025-01-06
--
-- This script will:
-- 1. Identify tasks that were auto-synced from meeting_action_items
-- 2. Remove the sync relationship in meeting_action_items
-- 3. Delete the auto-created tasks from the tasks table
-- 4. Preserve manually created tasks

-- First, let's see what we're dealing with
SELECT
    'Analysis' as step,
    COUNT(DISTINCT t.id) as auto_synced_tasks,
    COUNT(DISTINCT mai.id) as linked_action_items
FROM tasks t
INNER JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE mai.synced_to_task = true
  AND mai.sync_status = 'synced';

-- Step 1: Unlink action items from tasks (preserves action items, breaks sync relationship)
UPDATE meeting_action_items
SET
    task_id = NULL,
    synced_to_task = false,
    sync_status = NULL,
    updated_at = NOW()
WHERE synced_to_task = true
  AND sync_status = 'synced'
  AND task_id IS NOT NULL;

-- Get count of updated action items
SELECT
    'Unlinked Action Items' as step,
    COUNT(*) as count
FROM meeting_action_items
WHERE task_id IS NULL
  AND updated_at > NOW() - INTERVAL '1 minute';

-- Step 2: Delete the auto-synced tasks
-- Note: This will only delete tasks that were created from action items
-- Tasks with meeting_id but without an action_item link are preserved
DELETE FROM tasks
WHERE id IN (
    SELECT DISTINCT t.id
    FROM tasks t
    WHERE t.meeting_id IS NOT NULL
      AND t.created_at > '2024-01-01' -- Adjust date as needed
      AND NOT EXISTS (
          -- Preserve tasks that were manually created (not linked to action items before cleanup)
          SELECT 1 FROM meeting_action_items mai
          WHERE mai.task_id = t.id
            AND mai.synced_to_task = false
      )
      AND t.id NOT IN (
          -- Preserve tasks that still have action item links (manually added)
          SELECT task_id FROM meeting_action_items
          WHERE task_id IS NOT NULL
            AND synced_to_task = false
      )
);

-- Get count of deleted tasks
SELECT
    'Deleted Auto-Synced Tasks' as step,
    COUNT(*) as count
FROM tasks
WHERE updated_at > NOW() - INTERVAL '1 minute';

-- Step 3: Verification - Check remaining tasks
SELECT
    'Verification - Remaining Tasks' as step,
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN meeting_id IS NOT NULL THEN 1 END) as meeting_related_tasks,
    COUNT(CASE WHEN meeting_id IS NULL THEN 1 END) as non_meeting_tasks
FROM tasks;

-- Step 4: Verification - Check action items
SELECT
    'Verification - Action Items' as step,
    COUNT(*) as total_action_items,
    COUNT(CASE WHEN task_id IS NOT NULL THEN 1 END) as linked_to_tasks,
    COUNT(CASE WHEN synced_to_task = true THEN 1 END) as still_auto_synced
FROM meeting_action_items;

-- Final summary
SELECT
    'Summary' as report,
    'All auto-synced tasks removed. Action items preserved for manual task creation.' as status;

-- Optional: If you want to be more conservative and only mark for deletion
-- instead of actually deleting, uncomment this section and comment out the DELETE above:

/*
-- Add a flag column if it doesn't exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS marked_for_deletion BOOLEAN DEFAULT false;

-- Mark tasks for deletion instead of deleting
UPDATE tasks
SET marked_for_deletion = true
WHERE id IN (
    SELECT DISTINCT t.id
    FROM tasks t
    WHERE t.meeting_id IS NOT NULL
      AND t.created_at > '2024-01-01'
      AND NOT EXISTS (
          SELECT 1 FROM meeting_action_items mai
          WHERE mai.task_id = t.id
            AND mai.synced_to_task = false
      )
);

-- Review marked tasks before actual deletion
SELECT
    t.id,
    t.title,
    t.description,
    t.created_at,
    t.meeting_id,
    m.title as meeting_title
FROM tasks t
LEFT JOIN meetings m ON m.id = t.meeting_id
WHERE t.marked_for_deletion = true
ORDER BY t.created_at DESC
LIMIT 100;
*/
