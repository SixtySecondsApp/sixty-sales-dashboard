-- ========================================
-- RESTORE ACTION ITEMS FROM BACKUP
-- Copy this entire script and paste into Supabase SQL Editor
-- ========================================

-- Step 1: Check if backup exists
SELECT
    'Checking Backup' as step,
    COUNT(*) as items_in_backup
FROM meeting_action_items_backup_20250106;

-- Step 2: Restore from backup
INSERT INTO meeting_action_items
SELECT * FROM meeting_action_items_backup_20250106
ON CONFLICT (id) DO NOTHING;

-- Step 3: Unlink from tasks
UPDATE meeting_action_items
SET
    task_id = NULL,
    synced_to_task = false,
    sync_status = NULL,
    updated_at = NOW()
WHERE id IN (SELECT id FROM meeting_action_items_backup_20250106);

-- Step 4: Verify
SELECT
    '✅ RESTORE COMPLETE' as status,
    COUNT(*) as total_action_items
FROM meeting_action_items;

-- Step 5: Show action items per meeting
SELECT
    m.title as meeting,
    COUNT(mai.id) as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
GROUP BY m.id, m.title
ORDER BY m.meeting_start DESC
LIMIT 10;
