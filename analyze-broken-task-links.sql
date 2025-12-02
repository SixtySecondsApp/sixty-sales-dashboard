-- ============================================================================
-- BROKEN BIDIRECTIONAL LINK ANALYSIS
-- ============================================================================
-- Purpose: Identify tasks and action items with broken bidirectional links
-- ============================================================================

-- Query 1: Tasks missing meeting_action_item_id (broken forward link)
-- These tasks were created from action items but don't link back
SELECT
  'Tasks missing meeting_action_item_id' as issue_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM tasks WHERE source = 'fathom_action_item'), 2) as percentage
FROM tasks
WHERE source = 'fathom_action_item'
  AND meeting_action_item_id IS NULL
  AND metadata->>'action_item_id' IS NOT NULL;  -- Has action item ID in metadata but not in field

-- Query 2: Action items missing linked_task_id (broken backward link)
-- These action items have synced_to_task=true but no linked_task_id
SELECT
  'Action items missing linked_task_id' as issue_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true), 2) as percentage
FROM meeting_action_items
WHERE synced_to_task = true
  AND linked_task_id IS NULL;

-- Query 3: Tasks that CAN be repaired (have action_item_id in metadata)
-- These tasks have the action item ID stored in metadata, so we can repair the link
SELECT
  'Repairable tasks' as category,
  COUNT(*) as count
FROM tasks
WHERE source = 'fathom_action_item'
  AND meeting_action_item_id IS NULL
  AND metadata->>'action_item_id' IS NOT NULL;

-- Query 4: Action items that CAN be repaired (have corresponding tasks)
-- Find action items where we can find the matching task via metadata
WITH tasks_with_action_item_metadata AS (
  SELECT
    id as task_id,
    (metadata->>'action_item_id')::uuid as action_item_id_from_metadata
  FROM tasks
  WHERE source = 'fathom_action_item'
    AND metadata->>'action_item_id' IS NOT NULL
)
SELECT
  'Repairable action items' as category,
  COUNT(DISTINCT mai.id) as count
FROM meeting_action_items mai
INNER JOIN tasks_with_action_item_metadata t
  ON mai.id = t.action_item_id_from_metadata
WHERE mai.synced_to_task = true
  AND mai.linked_task_id IS NULL;

-- Query 5: Orphaned tasks (no action item exists)
-- Tasks claiming to be from action items, but action item doesn't exist
SELECT
  'Orphaned tasks (action item deleted)' as category,
  COUNT(*) as count
FROM tasks t
WHERE t.source = 'fathom_action_item'
  AND t.metadata->>'action_item_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM meeting_action_items mai
    WHERE mai.id = (t.metadata->>'action_item_id')::uuid
  );

-- Query 6: Duplicate tasks from same action item
-- Multiple tasks created from the same action item (the "doubling up" issue)
WITH action_item_task_counts AS (
  SELECT
    (metadata->>'action_item_id')::uuid as action_item_id,
    COUNT(*) as task_count
  FROM tasks
  WHERE source = 'fathom_action_item'
    AND metadata->>'action_item_id' IS NOT NULL
  GROUP BY (metadata->>'action_item_id')::uuid
)
SELECT
  'Action items with multiple tasks' as category,
  COUNT(*) as action_items_with_duplicates,
  SUM(task_count) as total_duplicate_tasks,
  MAX(task_count) as max_tasks_per_action_item
FROM action_item_task_counts
WHERE task_count > 1;

-- Query 7: Summary statistics
SELECT
  'Summary Statistics' as report_section,
  (SELECT COUNT(*) FROM tasks WHERE source = 'fathom_action_item') as total_fathom_tasks,
  (SELECT COUNT(*) FROM tasks WHERE source = 'fathom_action_item' AND meeting_action_item_id IS NOT NULL) as tasks_with_forward_link,
  (SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true) as action_items_synced,
  (SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true AND linked_task_id IS NOT NULL) as action_items_with_backward_link;

-- Query 8: Sample of broken tasks for manual inspection
SELECT
  t.id as task_id,
  t.title,
  t.created_at,
  t.meeting_action_item_id as current_link,
  (t.metadata->>'action_item_id')::uuid as action_item_id_from_metadata,
  CASE
    WHEN mai.id IS NOT NULL THEN 'Action item exists'
    ELSE 'Action item missing'
  END as action_item_status,
  mai.linked_task_id as action_item_links_to
FROM tasks t
LEFT JOIN meeting_action_items mai ON mai.id = (t.metadata->>'action_item_id')::uuid
WHERE t.source = 'fathom_action_item'
  AND t.meeting_action_item_id IS NULL
  AND t.metadata->>'action_item_id' IS NOT NULL
ORDER BY t.created_at DESC
LIMIT 20;

-- Query 9: Find actual duplicate tasks (same action item, same title)
WITH duplicate_tasks AS (
  SELECT
    (t.metadata->>'action_item_id')::uuid as action_item_id,
    t.title,
    array_agg(t.id ORDER BY t.created_at) as task_ids,
    array_agg(t.created_at ORDER BY t.created_at) as created_dates,
    COUNT(*) as duplicate_count
  FROM tasks t
  WHERE t.source = 'fathom_action_item'
    AND t.metadata->>'action_item_id' IS NOT NULL
  GROUP BY (t.metadata->>'action_item_id')::uuid, t.title
  HAVING COUNT(*) > 1
)
SELECT
  'Duplicate task sets' as category,
  action_item_id,
  title,
  duplicate_count,
  task_ids[1] as keep_task_id,
  task_ids[2:array_length(task_ids, 1)] as duplicate_task_ids_to_delete,
  created_dates
FROM duplicate_tasks
ORDER BY duplicate_count DESC, created_dates[1] DESC
LIMIT 50;

-- ============================================================================
-- SUMMARY: What to look for
-- ============================================================================
-- Query 1: How many tasks are missing forward links (meeting_action_item_id)
-- Query 2: How many action items are missing backward links (linked_task_id)
-- Query 3: How many tasks can be repaired (have metadata)
-- Query 4: How many action items can be repaired (matching task exists)
-- Query 5: How many orphaned tasks (action item deleted)
-- Query 6: Duplicate task detection (multiple tasks from same action item)
-- Query 7: Summary statistics for overall health
-- Query 8: Sample of broken tasks for inspection
-- Query 9: Specific duplicate tasks to clean up
-- ============================================================================
