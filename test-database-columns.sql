-- Test Script: Verify Database Column Names
-- Run this first to see what columns actually exist in your database
-- This helps avoid column name errors

-- ========================================
-- Check meeting_action_items columns
-- ========================================
SELECT
    'meeting_action_items columns' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- Check tasks columns
-- ========================================
SELECT
    'tasks columns' as table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- Quick count of auto-synced items
-- ========================================
SELECT
    'Auto-Synced Status' as check,
    COUNT(*) FILTER (WHERE synced_to_task = true) as auto_synced_items,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as items_linked_to_tasks,
    COUNT(*) as total_action_items
FROM meeting_action_items;

-- ========================================
-- Identify user column in tasks table
-- ========================================
SELECT
    'Tasks User Column Detection' as info,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'user_id'
        ) THEN 'user_id exists'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'owner_id'
        ) THEN 'owner_id exists'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tasks' AND column_name = 'assigned_to'
        ) THEN 'assigned_to exists'
        ELSE 'unknown user column'
    END as column_found;
