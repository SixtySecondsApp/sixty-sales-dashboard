-- ============================================================================
-- Clean Up Old AI-Generated Tasks and Reset for New Auto-Sync System
-- ============================================================================
-- Purpose: Remove tasks created by the old broken AI suggestion system
--          and reset action items to allow fresh auto-sync with new system
-- ============================================================================

-- Step 1: Check what columns exist in meeting_action_items
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'meeting_action_items'
  AND column_name IN ('task_id', 'linked_task_id', 'synced_to_task', 'sync_status')
ORDER BY column_name;

-- Step 2: Preview what will be deleted
SELECT
  'Tasks to be deleted' as category,
  COUNT(*) as count,
  source,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM tasks
WHERE source = 'ai_suggestion'
GROUP BY source;

-- Step 3: Preview affected action items that will be reset (using task_id)
SELECT
  'Action items to reset' as category,
  COUNT(*) as count
FROM meeting_action_items
WHERE task_id IN (
    SELECT id FROM tasks WHERE source = 'ai_suggestion'
  );

-- Step 4: Preview affected suggestions (if table exists)
-- Note: Uncomment if next_action_suggestions table exists
-- SELECT
--   'Suggestions to reset' as category,
--   COUNT(*) as count
-- FROM next_action_suggestions
-- WHERE task_id IN (
--     SELECT id FROM tasks WHERE source = 'ai_suggestion'
--   );

-- ============================================================================
-- POINT OF NO RETURN - Uncomment the following to execute cleanup
-- ============================================================================

-- Step 5: Reset meeting_action_items (unlink from deleted tasks)
-- SIMPLE VERSION (using only task_id column)
-- UPDATE meeting_action_items
-- SET
--   task_id = null,
--   updated_at = NOW()
-- WHERE task_id IN (
--     SELECT id FROM tasks WHERE source = 'ai_suggestion'
--   );

-- Step 6: Delete old AI-generated tasks
-- DELETE FROM tasks
-- WHERE source = 'ai_suggestion';

-- ============================================================================
-- Verification Queries (run after cleanup)
-- ============================================================================

-- Verify tasks deleted
SELECT
  'Remaining AI tasks' as check_type,
  COUNT(*) as count
FROM tasks
WHERE source = 'ai_suggestion';

-- Verify action items reset
SELECT
  'Reset action items' as check_type,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE task_id IS NULL) as unlinked,
  COUNT(*) FILTER (WHERE importance IS NOT NULL) as has_importance
FROM meeting_action_items;

-- ============================================================================
-- Summary of what remains
-- ============================================================================

-- Count tasks by source after cleanup
SELECT
  source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM tasks
GROUP BY source
ORDER BY count DESC;
