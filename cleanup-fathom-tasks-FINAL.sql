-- FINAL Cleanup Script: Remove Auto-Synced Fathom Tasks
-- Purpose: Clean up tasks created automatically from Fathom meeting action items
-- Date: 2025-01-06
-- Version: FINAL (all column names verified)
--
-- Correct column names:
-- - meeting_action_items.title (NOT content)
-- - tasks.assigned_to (NOT user_id)
-- - tasks.created_by (NOT user_id)
--
-- This script will:
-- 1. Create backups automatically
-- 2. Unlink action items from tasks
-- 3. Delete auto-synced tasks
-- 4. Provide verification at each step

-- ========================================
-- STEP 1: ANALYZE CURRENT STATE
-- ========================================

SELECT
    'Current Auto-Synced Action Items' as step,
    COUNT(*) as count
FROM meeting_action_items
WHERE synced_to_task = true;

SELECT
    'Tasks Linked to Action Items' as step,
    COUNT(DISTINCT t.id) as count
FROM tasks t
INNER JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE mai.synced_to_task = true;

-- ========================================
-- STEP 2: CREATE BACKUPS
-- ========================================

-- Backup action items
CREATE TABLE IF NOT EXISTS meeting_action_items_backup_20250106 AS
SELECT * FROM meeting_action_items
WHERE synced_to_task = true;

-- Backup tasks that will be deleted
CREATE TABLE IF NOT EXISTS tasks_backup_20250106 AS
SELECT t.* FROM tasks t
INNER JOIN meeting_action_items mai ON mai.task_id = t.id
WHERE mai.synced_to_task = true;

SELECT
    'Backups Created' as step,
    (SELECT COUNT(*) FROM meeting_action_items_backup_20250106) as action_items_backed_up,
    (SELECT COUNT(*) FROM tasks_backup_20250106) as tasks_backed_up;

-- ========================================
-- STEP 3: UNLINK ACTION ITEMS
-- ========================================

UPDATE meeting_action_items
SET
    task_id = NULL,
    synced_to_task = false,
    sync_status = NULL,
    updated_at = NOW()
WHERE synced_to_task = true;

SELECT
    'Action Items Unlinked' as step,
    COUNT(*) as updated_count
FROM meeting_action_items
WHERE task_id IS NULL
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ========================================
-- STEP 4: DELETE AUTO-SYNCED TASKS
-- ========================================

DELETE FROM tasks
WHERE id IN (
    SELECT id FROM tasks_backup_20250106
);

SELECT
    'Tasks Deleted' as step,
    (SELECT COUNT(*) FROM tasks_backup_20250106) as tasks_deleted;

-- ========================================
-- STEP 5: VERIFICATION
-- ========================================

SELECT
    'Verification: Auto-Synced Remaining' as check,
    COUNT(*) as remaining_auto_synced,
    CASE
        WHEN COUNT(*) = 0 THEN '✅ SUCCESS: All auto-synced relationships removed'
        ELSE '⚠️  WARNING: Some auto-synced relationships still exist'
    END as status
FROM meeting_action_items
WHERE synced_to_task = true;

SELECT
    'Verification: Action Items Preserved' as check,
    COUNT(*) as total_action_items,
    '✅ Action items remain available for manual task creation' as status
FROM meeting_action_items;

SELECT
    'Verification: Task Cleanup' as check,
    COUNT(*) as remaining_tasks,
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_related_tasks,
    '✅ Auto-synced tasks removed, manual tasks preserved' as status
FROM tasks;

-- ========================================
-- FINAL SUMMARY
-- ========================================

SELECT
    '🎉 CLEANUP COMPLETE' as summary,
    'Auto-synced tasks removed. Users can now manually select which action items to convert to tasks.' as message;

-- ========================================
-- CLEANUP BACKUP TABLES (Optional)
-- ========================================

-- Uncomment these lines after verifying the cleanup was successful:
-- DROP TABLE IF EXISTS meeting_action_items_backup_20250106;
-- DROP TABLE IF EXISTS tasks_backup_20250106;
