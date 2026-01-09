-- ============================================================================
-- Fix Existing Task Bidirectional Links
-- ============================================================================
-- Purpose: Fix bidirectional sync links between tasks and action items
-- Note: Tasks from next_action_suggestions use metadata->>'suggestion_id' for linking
--       Only tasks from meeting_action_items use meeting_action_item_id field
-- ============================================================================

-- Step 1: Fix backward links for AI suggestion tasks
-- These tasks already have suggestion_id in metadata, we just need to update the suggestions table
UPDATE next_action_suggestions nas
SET
  linked_task_id = t.id,
  synced_to_task = true,
  sync_status = 'synced',
  updated_at = NOW()
FROM tasks t
WHERE t.source = 'ai_suggestion'
  AND (t.metadata->>'suggestion_id')::uuid = nas.id
  AND nas.linked_task_id IS NULL;

-- Step 2: Fix forward links for meeting action item tasks
-- Only update tasks that reference meeting_action_items (not next_action_suggestions)
UPDATE tasks t
SET
  meeting_action_item_id = (t.metadata->>'action_item_id')::uuid,
  updated_at = NOW()
WHERE t.source = 'fathom_action_item'
  AND t.meeting_action_item_id IS NULL
  AND t.metadata->>'action_item_id' IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM meeting_action_items mai
    WHERE mai.id = (t.metadata->>'action_item_id')::uuid
  );

-- Step 3: Fix backward links for meeting action item tasks
UPDATE meeting_action_items mai
SET
  linked_task_id = t.id,
  synced_to_task = true,
  sync_status = 'synced',
  updated_at = NOW()
FROM tasks t
WHERE t.meeting_action_item_id = mai.id
  AND mai.linked_task_id IS NULL;

-- Step 4: Report statistics and verify fixes
DO $$
DECLARE
  total_ai_tasks INTEGER;
  ai_suggestions_linked INTEGER;
  total_action_item_tasks INTEGER;
  action_items_linked INTEGER;
  ai_suggestions_with_backward_link INTEGER;
  action_items_with_backward_link INTEGER;
BEGIN
  -- Count AI suggestion tasks
  SELECT COUNT(*) INTO total_ai_tasks
  FROM tasks
  WHERE source = 'ai_suggestion';

  -- Count AI tasks with valid suggestion link in metadata
  SELECT COUNT(*) INTO ai_suggestions_linked
  FROM tasks t
  WHERE t.source = 'ai_suggestion'
    AND t.metadata->>'suggestion_id' IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM next_action_suggestions nas
      WHERE nas.id = (t.metadata->>'suggestion_id')::uuid
    );

  -- Count suggestions with backward links
  SELECT COUNT(*) INTO ai_suggestions_with_backward_link
  FROM next_action_suggestions
  WHERE linked_task_id IS NOT NULL;

  -- Count meeting action item tasks
  SELECT COUNT(*) INTO total_action_item_tasks
  FROM tasks
  WHERE source = 'fathom_action_item';

  -- Count action item tasks with forward links
  SELECT COUNT(*) INTO action_items_linked
  FROM tasks
  WHERE source = 'fathom_action_item'
    AND meeting_action_item_id IS NOT NULL;

  -- Count action items with backward links
  SELECT COUNT(*) INTO action_items_with_backward_link
  FROM meeting_action_items
  WHERE linked_task_id IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Task Link Fix Summary:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'AI SUGGESTION TASKS:';
  RAISE NOTICE '  Total: %', total_ai_tasks;
  RAISE NOTICE '  With valid suggestion link: % (%.1f%%)',
    ai_suggestions_linked,
    (ai_suggestions_linked::DECIMAL / NULLIF(total_ai_tasks, 0) * 100);
  RAISE NOTICE '  Suggestions with backward links: %', ai_suggestions_with_backward_link;
  RAISE NOTICE '';
  RAISE NOTICE 'MEETING ACTION ITEM TASKS:';
  RAISE NOTICE '  Total: %', total_action_item_tasks;
  RAISE NOTICE '  With forward links: % (%.1f%%)',
    action_items_linked,
    (action_items_linked::DECIMAL / NULLIF(total_action_item_tasks, 0) * 100);
  RAISE NOTICE '  Action items with backward links: %', action_items_with_backward_link;
  RAISE NOTICE '========================================';

  -- Assess success
  IF ai_suggestions_linked > (total_ai_tasks * 0.95) AND action_items_linked > (total_action_item_tasks * 0.95) THEN
    RAISE NOTICE '✅ SUCCESS: Over 95%% of tasks successfully linked!';
  ELSIF ai_suggestions_linked > (total_ai_tasks * 0.80) OR action_items_linked > (total_action_item_tasks * 0.80) THEN
    RAISE NOTICE '⚠️  PARTIAL: 80-95%% of tasks linked. Review needed.';
  ELSE
    RAISE NOTICE '❌ WARNING: Less than 80%% linked. Investigation required.';
  END IF;
END $$;

-- Step 5: Verification queries
-- Show sample of properly linked tasks
SELECT
  'AI Suggestion Tasks (via metadata)' as link_type,
  COUNT(*) as total_count,
  COUNT(CASE WHEN nas.linked_task_id IS NOT NULL THEN 1 END) as backward_links
FROM tasks t
LEFT JOIN next_action_suggestions nas ON (t.metadata->>'suggestion_id')::uuid = nas.id
WHERE t.source = 'ai_suggestion'

UNION ALL

SELECT
  'Meeting Action Item Tasks (via FK)' as link_type,
  COUNT(*) as total_count,
  COUNT(CASE WHEN mai.linked_task_id IS NOT NULL THEN 1 END) as backward_links
FROM tasks t
LEFT JOIN meeting_action_items mai ON t.meeting_action_item_id = mai.id
WHERE t.source = 'fathom_action_item';

-- ============================================================================
-- Schema Note
-- ============================================================================
-- IMPORTANT: There are TWO types of task-to-action-item links:
--
-- 1. AI Suggestion Tasks (source='ai_suggestion'):
--    - Forward link: metadata->>'suggestion_id' -> next_action_suggestions.id
--    - Backward link: next_action_suggestions.linked_task_id -> tasks.id
--    - DO NOT use meeting_action_item_id for these tasks
--
-- 2. Meeting Action Item Tasks (source='fathom_action_item'):
--    - Forward link: tasks.meeting_action_item_id -> meeting_action_items.id
--    - Backward link: meeting_action_items.linked_task_id -> tasks.id
--
-- This is by design due to foreign key constraints on meeting_action_item_id
-- ============================================================================
