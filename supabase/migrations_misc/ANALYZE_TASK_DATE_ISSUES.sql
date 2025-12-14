-- ============================================================================
-- ANALYSIS: Identify Tasks with Date Calculation Errors
-- ============================================================================
-- Purpose: Find tasks affected by the date calculation bug where:
--   1. Tasks created recently but have ancient due dates (>1 year in past)
--   2. Tasks >90 days old that are still incomplete
--   3. Tasks from AI extraction that have suspicious date patterns
--
-- Run this BEFORE archiving to understand the scope of the issue
-- ============================================================================

-- Query 1: Tasks with obvious date bug (created recently, due date ancient)
-- This is the smoking gun for the date calculation bug
SELECT
  t.id,
  t.title,
  t.due_date,
  t.created_at,
  t.status,
  t.assigned_to,
  p.email as assigned_email,
  mai.deadline_at as action_item_deadline,
  mai.assignee_email,
  m.meeting_start,
  m.title as meeting_title,
  -- Calculate how many days between creation and due date (should be positive!)
  EXTRACT(DAY FROM (t.due_date - t.created_at)) as days_diff,
  -- Calculate how "old" the task appears to be
  EXTRACT(DAY FROM (NOW() - t.due_date)) as days_overdue
FROM tasks t
LEFT JOIN meeting_action_items mai ON t.meeting_action_item_id = mai.id
LEFT JOIN meetings m ON mai.meeting_id = m.id
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE
  -- Task was created in last 6 months
  t.created_at > NOW() - INTERVAL '6 months'
  -- But due date is >1 year in the past
  AND t.due_date < NOW() - INTERVAL '1 year'
  -- Still incomplete
  AND t.status NOT IN ('completed', 'cancelled')
  -- From AI extraction
  AND t.meeting_action_item_id IS NOT NULL
ORDER BY t.due_date ASC
LIMIT 100;

-- Query 2: Summary statistics of the date bug impact
SELECT
  COUNT(*) as total_affected_tasks,
  COUNT(DISTINCT t.assigned_to) as affected_users,
  COUNT(DISTINCT mai.meeting_id) as affected_meetings,
  MIN(t.due_date) as oldest_bad_date,
  MAX(t.created_at) as most_recent_creation,
  AVG(EXTRACT(DAY FROM (NOW() - t.due_date))) as avg_days_overdue
FROM tasks t
LEFT JOIN meeting_action_items mai ON t.meeting_action_item_id = mai.id
WHERE
  t.created_at > NOW() - INTERVAL '6 months'
  AND t.due_date < NOW() - INTERVAL '1 year'
  AND t.status NOT IN ('completed', 'cancelled')
  AND t.meeting_action_item_id IS NOT NULL;

-- Query 3: Legitimately old tasks (>90 days, may need archiving)
SELECT
  COUNT(*) as total_old_tasks,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
  COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
  AVG(EXTRACT(DAY FROM (NOW() - created_at))) as avg_age_days
FROM tasks
WHERE
  created_at < NOW() - INTERVAL '90 days'
  AND status IN ('pending', 'in_progress', 'overdue')
  AND id NOT IN (
    -- Exclude date bug tasks (already counted above)
    SELECT t.id FROM tasks t
    WHERE t.created_at > NOW() - INTERVAL '6 months'
      AND t.due_date < NOW() - INTERVAL '1 year'
      AND t.meeting_action_item_id IS NOT NULL
  );

-- Query 4: Tasks by user showing potential mis-assignment
-- This helps identify if certain users got ALL the tasks
SELECT
  p.email as assigned_user,
  p.first_name,
  p.last_name,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
  COUNT(CASE WHEN t.due_date < NOW() - INTERVAL '90 days' THEN 1 END) as very_old_tasks,
  COUNT(CASE WHEN t.meeting_action_item_id IS NOT NULL THEN 1 END) as ai_generated_tasks,
  MIN(t.created_at) as oldest_task_created,
  MAX(t.created_at) as newest_task_created
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE t.status IN ('pending', 'in_progress', 'overdue')
GROUP BY p.email, p.first_name, p.last_name
ORDER BY total_tasks DESC
LIMIT 20;

-- Query 5: Action items that couldn't be converted to tasks
-- (These would now be caught by the new assignment bug fix)
SELECT
  mai.id,
  mai.title,
  mai.assignee_email,
  mai.assignee_name,
  mai.deadline_at,
  mai.sync_status,
  mai.ai_confidence,
  m.title as meeting_title,
  m.meeting_start,
  -- Check if email exists in profiles
  CASE
    WHEN EXISTS (SELECT 1 FROM profiles WHERE email = mai.assignee_email)
    THEN 'Internal User'
    ELSE 'External/Not Found'
  END as assignee_status
FROM meeting_action_items mai
LEFT JOIN meetings m ON mai.meeting_id = m.id
WHERE
  -- Not synced to task yet
  mai.synced_to_task = false
  -- Has assignee email
  AND mai.assignee_email IS NOT NULL
  -- From last 30 days
  AND mai.created_at > NOW() - INTERVAL '30 days'
ORDER BY mai.created_at DESC
LIMIT 50;

-- Query 6: Recommended action - Count of tasks to archive
WITH date_bug_tasks AS (
  SELECT id FROM tasks
  WHERE created_at > NOW() - INTERVAL '6 months'
    AND due_date < NOW() - INTERVAL '1 year'
    AND status NOT IN ('completed', 'cancelled')
    AND meeting_action_item_id IS NOT NULL
),
old_legitimate_tasks AS (
  SELECT id FROM tasks
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('pending', 'in_progress', 'overdue')
    AND id NOT IN (SELECT id FROM date_bug_tasks)
)
SELECT
  'Date Bug Tasks' as category,
  COUNT(*) as task_count,
  'Archive - clearly wrong dates' as recommended_action
FROM date_bug_tasks
UNION ALL
SELECT
  'Old Legitimate Tasks' as category,
  COUNT(*) as task_count,
  'Archive - over 90 days old' as recommended_action
FROM old_legitimate_tasks
UNION ALL
SELECT
  'Total Tasks to Archive' as category,
  COUNT(*) as task_count,
  'Run archive migration' as recommended_action
FROM (
  SELECT id FROM date_bug_tasks
  UNION
  SELECT id FROM old_legitimate_tasks
) combined;

-- ============================================================================
-- RECOMMENDATION SUMMARY
-- ============================================================================
-- After running these queries, you should:
--
-- 1. Review Query 1 results - these are DEFINITELY date bug tasks
-- 2. Review Query 4 - identify if one user has 8000+ tasks (the bug symptom)
-- 3. Review Query 5 - these action items would fail with new assignment logic
-- 4. Run the archive migration (Phase 5.2) to clean up
-- 5. Deploy the fixed edge functions to prevent new issues
--
-- Expected findings:
-- - Query 1: Should show tasks with due_date in 2024 but created in 2025
-- - Query 4: One user will have dramatically more tasks than others
-- - Query 5: Many action items with external emails or typos
-- ============================================================================
