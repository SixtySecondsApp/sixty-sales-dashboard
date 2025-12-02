-- ============================================================================
-- BROKEN BIDIRECTIONAL LINK ANALYSIS (FIXED FOR ai_suggestion source)
-- ============================================================================
-- Purpose: Identify tasks and action items with broken bidirectional links
-- ============================================================================

-- Query 1: Tasks missing meeting_action_item_id (broken forward link)
SELECT
  'Tasks missing meeting_action_item_id' as issue_type,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM tasks WHERE source = 'ai_suggestion'), 0), 2) as percentage
FROM tasks
WHERE source = 'ai_suggestion'
  AND meeting_action_item_id IS NULL;

-- Query 2: Tasks with meeting_id but no action_item_id link
SELECT
  'Tasks from meetings without action item link' as issue_type,
  COUNT(*) as count
FROM tasks
WHERE source = 'ai_suggestion'
  AND meeting_id IS NOT NULL
  AND meeting_action_item_id IS NULL;

-- Query 3: Check if tasks have action_item_id in metadata
SELECT
  'Tasks with action_item_id in metadata' as category,
  COUNT(*) as count
FROM tasks
WHERE source = 'ai_suggestion'
  AND metadata IS NOT NULL
  AND metadata->>'action_item_id' IS NOT NULL;

-- Query 4: Action items missing linked_task_id (broken backward link)
SELECT
  'Action items marked synced but missing link' as issue_type,
  COUNT(*) as count
FROM meeting_action_items
WHERE synced_to_task = true
  AND linked_task_id IS NULL;

-- Query 5: Action items that should have tasks
SELECT
  'Action items that should be synced' as category,
  COUNT(*) as total_action_items,
  COUNT(CASE WHEN synced_to_task = true THEN 1 END) as marked_synced,
  COUNT(CASE WHEN linked_task_id IS NOT NULL THEN 1 END) as has_link,
  COUNT(CASE WHEN synced_to_task = true AND linked_task_id IS NULL THEN 1 END) as broken_links
FROM meeting_action_items;

-- Query 6: Can we match tasks to action items by meeting_id and title?
WITH potential_matches AS (
  SELECT
    t.id as task_id,
    t.title as task_title,
    t.meeting_id,
    t.created_at as task_created,
    mai.id as action_item_id,
    mai.title as action_item_title,
    mai.created_at as action_item_created,
    similarity(t.title, mai.title) as title_similarity
  FROM tasks t
  INNER JOIN meeting_action_items mai
    ON t.meeting_id = mai.meeting_id
  WHERE t.source = 'ai_suggestion'
    AND t.meeting_action_item_id IS NULL
    AND mai.linked_task_id IS NULL
    AND t.title IS NOT NULL
    AND mai.title IS NOT NULL
)
SELECT
  'Matchable by meeting + title similarity' as category,
  COUNT(*) as potential_matches,
  COUNT(CASE WHEN title_similarity > 0.8 THEN 1 END) as high_confidence_matches,
  COUNT(CASE WHEN title_similarity > 0.6 AND title_similarity <= 0.8 THEN 1 END) as medium_confidence_matches
FROM potential_matches;

-- Query 7: Sample of broken tasks
SELECT
  t.id as task_id,
  t.title,
  t.created_at,
  t.meeting_id,
  t.meeting_action_item_id as current_link,
  m.title as meeting_title,
  (SELECT COUNT(*) FROM meeting_action_items WHERE meeting_id = t.meeting_id) as action_items_in_meeting
FROM tasks t
LEFT JOIN meetings m ON t.meeting_id = m.id
WHERE t.source = 'ai_suggestion'
  AND t.meeting_action_item_id IS NULL
  AND t.meeting_id IS NOT NULL
ORDER BY t.created_at DESC
LIMIT 20;

-- Query 8: Check for task_id column on meeting_action_items (old schema)
-- This will help us understand if tasks were using old column name
SELECT
  'Action items with task_id (old schema)' as category,
  COUNT(*) as count
FROM meeting_action_items
WHERE task_id IS NOT NULL;

-- Query 9: Summary Statistics
SELECT
  'Summary' as report,
  (SELECT COUNT(*) FROM tasks WHERE source = 'ai_suggestion') as total_ai_tasks,
  (SELECT COUNT(*) FROM tasks WHERE source = 'ai_suggestion' AND meeting_action_item_id IS NOT NULL) as with_action_item_link,
  (SELECT COUNT(*) FROM tasks WHERE source = 'ai_suggestion' AND meeting_action_item_id IS NULL) as missing_link,
  (SELECT COUNT(*) FROM meeting_action_items) as total_action_items,
  (SELECT COUNT(*) FROM meeting_action_items WHERE synced_to_task = true) as marked_synced,
  (SELECT COUNT(*) FROM meeting_action_items WHERE linked_task_id IS NOT NULL) as with_task_link;

-- ============================================================================
-- WHAT TO LOOK FOR:
-- ============================================================================
-- Query 1: How many tasks are missing forward links
-- Query 2: Tasks from meetings without action item links
-- Query 3: Do tasks have action_item_id in metadata?
-- Query 4: Action items marked synced but no link
-- Query 5: Overall action item sync status
-- Query 6: Can we match tasks to action items by similarity?
-- Query 7: Sample broken tasks for manual inspection
-- Query 8: Check if old task_id column is being used
-- Query 9: Summary statistics
-- ============================================================================
