-- ============================================================================
-- Clean Up Old AI-Generated Tasks and Reset for New Auto-Sync System
-- ============================================================================
-- Purpose: Remove tasks created by the old broken AI suggestion system
--          and reset action items to allow fresh auto-sync with new system
-- ============================================================================

-- Step 1: Preview what will be deleted
SELECT
  'Tasks to be deleted' as category,
  COUNT(*) as count,
  source,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM tasks
WHERE source = 'ai_suggestion'
GROUP BY source;

-- Step 2: Preview affected action items that will be reset
SELECT
  'Action items to reset' as category,
  COUNT(*) as count
FROM meeting_action_items
WHERE synced_to_task = true
  AND linked_task_id IN (
    SELECT id FROM tasks WHERE source = 'ai_suggestion'
  );

-- Step 3: Preview affected suggestions that will be reset
SELECT
  'Suggestions to reset' as category,
  COUNT(*) as count
FROM next_action_suggestions
WHERE synced_to_task = true
  AND linked_task_id IN (
    SELECT id FROM tasks WHERE source = 'ai_suggestion'
  );

-- ============================================================================
-- POINT OF NO RETURN - Uncomment the following to execute cleanup
-- ============================================================================

-- Step 4: Reset meeting_action_items (unlink from deleted tasks)
-- UPDATE meeting_action_items
-- SET
--   synced_to_task = false,
--   linked_task_id = null,
--   sync_status = null,
--   updated_at = NOW()
-- WHERE synced_to_task = true
--   AND linked_task_id IN (
--     SELECT id FROM tasks WHERE source = 'ai_suggestion'
--   );

-- Step 5: Reset next_action_suggestions (unlink from deleted tasks)
-- UPDATE next_action_suggestions
-- SET
--   synced_to_task = false,
--   linked_task_id = null,
--   sync_status = null,
--   updated_at = NOW()
-- WHERE synced_to_task = true
--   AND linked_task_id IN (
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
  COUNT(*) as reset_count,
  COUNT(*) FILTER (WHERE synced_to_task = false) as ready_for_sync
FROM meeting_action_items
WHERE importance IS NOT NULL;

-- Verify suggestions reset
SELECT
  'Reset suggestions' as check_type,
  COUNT(*) as reset_count,
  COUNT(*) FILTER (WHERE synced_to_task = false) as ready_for_sync
FROM next_action_suggestions
WHERE importance IS NOT NULL;

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
