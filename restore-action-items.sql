-- Restore Action Items from Backup
-- Purpose: Restore meeting action items that were accidentally deleted
-- Date: 2025-01-06

-- ========================================
-- STEP 1: Check if backup exists
-- ========================================

SELECT
    'Backup Table Check' as step,
    COUNT(*) as action_items_in_backup
FROM meeting_action_items_backup_20250106;

-- ========================================
-- STEP 2: Check current state
-- ========================================

SELECT
    'Current State' as step,
    COUNT(*) as current_action_items
FROM meeting_action_items;

-- ========================================
-- STEP 3: Restore action items from backup
-- ========================================

-- This will restore all action items from the backup
-- It uses ON CONFLICT to avoid duplicates
INSERT INTO meeting_action_items
SELECT * FROM meeting_action_items_backup_20250106
ON CONFLICT (id) DO NOTHING;

SELECT
    'Action Items Restored' as step,
    COUNT(*) as total_action_items_now
FROM meeting_action_items;

-- ========================================
-- STEP 4: Reset sync flags (keep them unlinked from tasks)
-- ========================================

-- Make sure all restored items are NOT synced to tasks
UPDATE meeting_action_items
SET
    task_id = NULL,
    synced_to_task = false,
    sync_status = NULL,
    updated_at = NOW()
WHERE id IN (SELECT id FROM meeting_action_items_backup_20250106);

SELECT
    'Sync Flags Reset' as step,
    COUNT(*) FILTER (WHERE synced_to_task = false) as unsynced_items,
    COUNT(*) FILTER (WHERE task_id IS NULL) as unlinked_items,
    COUNT(*) as total_items
FROM meeting_action_items;

-- ========================================
-- STEP 5: Verification
-- ========================================

-- Count action items per meeting
SELECT
    'Action Items per Meeting' as verification,
    m.title as meeting_title,
    m.meeting_start,
    COUNT(mai.id) as action_item_count
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
GROUP BY m.id, m.title, m.meeting_start
ORDER BY m.meeting_start DESC
LIMIT 20;

-- Final summary
SELECT
    '✅ RESTORE COMPLETE' as summary,
    'Action items restored from backup. All items are unlinked from tasks and ready for manual selection.' as message;
