-- ============================================================================
-- TASK SOURCE ANALYSIS
-- ============================================================================
-- Purpose: Understand where tasks are coming from
-- ============================================================================

-- Query 1: What sources do tasks have?
SELECT
  COALESCE(source, 'NULL') as source,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
GROUP BY source
ORDER BY count DESC;

-- Query 2: Tasks with meeting_id (created from meetings)
SELECT
  'Tasks with meeting_id' as category,
  COUNT(*) as count,
  COUNT(CASE WHEN meeting_action_item_id IS NOT NULL THEN 1 END) as with_action_item_link,
  COUNT(CASE WHEN meeting_action_item_id IS NULL THEN 1 END) as without_action_item_link
FROM tasks
WHERE meeting_id IS NOT NULL;

-- Query 3: Check metadata for action_item_id
SELECT
  'Tasks with action_item_id in metadata' as category,
  COUNT(*) as count
FROM tasks
WHERE metadata->>'action_item_id' IS NOT NULL;

-- Query 4: Full task breakdown by links
SELECT
  CASE
    WHEN meeting_action_item_id IS NOT NULL THEN 'Has meeting_action_item_id'
    WHEN meeting_id IS NOT NULL THEN 'Has meeting_id only'
    ELSE 'No meeting link'
  END as link_status,
  COUNT(*) as count
FROM tasks
GROUP BY link_status
ORDER BY count DESC;

-- Query 5: Sample tasks to understand structure
SELECT
  id,
  title,
  source,
  meeting_id,
  meeting_action_item_id,
  metadata->>'action_item_id' as metadata_action_item_id,
  created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 20;
