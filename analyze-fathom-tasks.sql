-- Analysis Script: Fathom Auto-Synced Tasks
-- Purpose: Analyze tasks that were automatically synced from Fathom meetings
-- This is a READ-ONLY analysis script - no data will be modified
-- Date: 2025-01-06

-- Overview: Count of tasks by source
SELECT
    'Task Source Overview' as analysis,
    COUNT(*) FILTER (WHERE meeting_id IS NOT NULL) as meeting_related_tasks,
    COUNT(*) FILTER (WHERE meeting_id IS NULL) as regular_tasks,
    COUNT(*) as total_tasks
FROM tasks;

-- Action Items Overview
SELECT
    'Action Items Overview' as analysis,
    COUNT(*) as total_action_items,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as linked_to_tasks,
    COUNT(*) FILTER (WHERE synced_to_task = true) as auto_synced,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL AND synced_to_task = false) as manually_linked
FROM meeting_action_items;

-- Detailed view of auto-synced relationships
SELECT
    'Auto-Synced Tasks Detail' as analysis,
    mai.id as action_item_id,
    mai.title as action_item_title,
    mai.task_id,
    mai.synced_to_task,
    mai.sync_status,
    t.title as task_title,
    t.status as task_status,
    t.created_at as task_created_at,
    m.title as meeting_title,
    m.meeting_start as meeting_date
FROM meeting_action_items mai
LEFT JOIN tasks t ON t.id = mai.task_id
LEFT JOIN meetings m ON m.id = mai.meeting_id
WHERE mai.synced_to_task = true
  OR mai.sync_status = 'synced'
ORDER BY t.created_at DESC
LIMIT 50;

-- Tasks created from meetings (potential auto-sync)
SELECT
    'Meeting-Related Tasks' as analysis,
    t.id,
    t.title,
    t.description,
    t.status,
    t.created_at,
    m.title as meeting_title,
    m.meeting_start as meeting_date,
    mai.id as linked_action_item_id,
    mai.synced_to_task
FROM tasks t
INNER JOIN meetings m ON m.id = t.meeting_id
LEFT JOIN meeting_action_items mai ON mai.task_id = t.id
ORDER BY t.created_at DESC
LIMIT 50;

-- Count by user (via meetings owner)
SELECT
    'Tasks by User' as analysis,
    u.email,
    COUNT(t.id) as total_tasks,
    COUNT(t.id) FILTER (WHERE t.meeting_id IS NOT NULL) as meeting_tasks,
    COUNT(mai.id) FILTER (WHERE mai.synced_to_task = true) as auto_synced_tasks
FROM auth.users u
LEFT JOIN tasks t ON t.user_id = u.id
LEFT JOIN meeting_action_items mai ON mai.task_id = t.id AND mai.synced_to_task = true
GROUP BY u.id, u.email
ORDER BY total_tasks DESC;

-- Action items without tasks (ready for manual selection)
SELECT
    'Action Items Without Tasks' as analysis,
    COUNT(*) as action_items_ready_for_manual_selection,
    COUNT(*) FILTER (WHERE completed = false) as incomplete_action_items
FROM meeting_action_items
WHERE task_id IS NULL
  AND completed = false;

-- Summary Report
SELECT
    'SUMMARY REPORT' as section,
    (SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true) as auto_synced_action_items,
    (SELECT COUNT(*) FROM tasks WHERE meeting_id IS NOT NULL) as meeting_related_tasks,
    (SELECT COUNT(*) FROM meeting_action_items WHERE task_id IS NULL) as action_items_without_tasks,
    (SELECT COUNT(*) FROM tasks) as total_tasks_in_system;
