-- ============================================================================
-- COMPREHENSIVE TASK DISTRIBUTION ANALYSIS
-- ============================================================================
-- Purpose: Find out why user has 8000+ tasks and what their characteristics are
-- ============================================================================

-- Query 1: Total task count by status (baseline)
SELECT
  status,
  COUNT(*) as task_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
GROUP BY status
ORDER BY task_count DESC;

-- Query 2: Task distribution by assigned user (WHO has all the tasks?)
SELECT
  p.email as assigned_user,
  p.first_name,
  p.last_name,
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN t.status = 'overdue' THEN 1 END) as overdue
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
GROUP BY p.email, p.first_name, p.last_name
ORDER BY total_tasks DESC
LIMIT 20;

-- Query 3: Task creation timeline (WHEN were all these tasks created?)
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as tasks_created,
  COUNT(CASE WHEN meeting_action_item_id IS NOT NULL THEN 1 END) as from_ai,
  COUNT(CASE WHEN meeting_action_item_id IS NULL THEN 1 END) as manual
FROM tasks
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC
LIMIT 12;

-- Query 4: Due date distribution (WHEN are tasks due?)
SELECT
  CASE
    WHEN due_date IS NULL THEN 'No due date'
    WHEN due_date < NOW() - INTERVAL '1 year' THEN '>1 year overdue'
    WHEN due_date < NOW() - INTERVAL '6 months' THEN '6-12 months overdue'
    WHEN due_date < NOW() - INTERVAL '3 months' THEN '3-6 months overdue'
    WHEN due_date < NOW() - INTERVAL '1 month' THEN '1-3 months overdue'
    WHEN due_date < NOW() - INTERVAL '1 week' THEN '1-4 weeks overdue'
    WHEN due_date < NOW() THEN 'This week overdue'
    WHEN due_date < NOW() + INTERVAL '1 week' THEN 'Due this week'
    WHEN due_date < NOW() + INTERVAL '1 month' THEN 'Due within month'
    ELSE 'Due later'
  END as due_date_category,
  COUNT(*) as task_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
WHERE status IN ('pending', 'in_progress', 'overdue')
GROUP BY due_date_category
ORDER BY
  CASE due_date_category
    WHEN 'No due date' THEN 1
    WHEN '>1 year overdue' THEN 2
    WHEN '6-12 months overdue' THEN 3
    WHEN '3-6 months overdue' THEN 4
    WHEN '1-3 months overdue' THEN 5
    WHEN '1-4 weeks overdue' THEN 6
    WHEN 'This week overdue' THEN 7
    WHEN 'Due this week' THEN 8
    WHEN 'Due within month' THEN 9
    ELSE 10
  END;

-- Query 5: Task source breakdown (WHERE did they come from?)
SELECT
  CASE
    WHEN meeting_action_item_id IS NOT NULL THEN 'From AI (Fathom)'
    WHEN source = 'fathom_action_item' THEN 'From AI (legacy)'
    WHEN meeting_id IS NOT NULL THEN 'Manual from meeting'
    WHEN deal_id IS NOT NULL THEN 'From deal'
    WHEN company_id IS NOT NULL THEN 'From company'
    WHEN contact_id IS NOT NULL THEN 'From contact'
    ELSE 'Other/Manual'
  END as task_source,
  COUNT(*) as task_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
WHERE status IN ('pending', 'in_progress', 'overdue')
GROUP BY task_source
ORDER BY task_count DESC;

-- Query 6: Task category distribution
SELECT
  COALESCE(task_type, 'unknown') as category,
  COUNT(*) as task_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks
WHERE status IN ('pending', 'in_progress', 'overdue')
GROUP BY task_type
ORDER BY task_count DESC;

-- Query 7: Find the specific user with 8000+ tasks and their task details
WITH user_task_counts AS (
  SELECT
    assigned_to,
    COUNT(*) as total_tasks
  FROM tasks
  WHERE status IN ('pending', 'in_progress', 'overdue')
  GROUP BY assigned_to
  ORDER BY total_tasks DESC
  LIMIT 1
)
SELECT
  p.email as your_email,
  p.first_name,
  p.last_name,
  utc.total_tasks,
  COUNT(CASE WHEN t.meeting_action_item_id IS NOT NULL THEN 1 END) as from_ai,
  COUNT(CASE WHEN t.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as created_last_30_days,
  COUNT(CASE WHEN t.created_at > NOW() - INTERVAL '90 days' THEN 1 END) as created_last_90_days,
  COUNT(CASE WHEN t.due_date < NOW() THEN 1 END) as overdue_count,
  MIN(t.created_at) as oldest_task,
  MAX(t.created_at) as newest_task
FROM user_task_counts utc
JOIN tasks t ON t.assigned_to = utc.assigned_to
LEFT JOIN profiles p ON p.id = utc.assigned_to
WHERE t.status IN ('pending', 'in_progress', 'overdue')
GROUP BY p.email, p.first_name, p.last_name, utc.total_tasks;

-- Query 8: Sample of your tasks to understand their nature
WITH user_with_most_tasks AS (
  SELECT assigned_to
  FROM tasks
  WHERE status IN ('pending', 'in_progress', 'overdue')
  GROUP BY assigned_to
  ORDER BY COUNT(*) DESC
  LIMIT 1
)
SELECT
  t.title,
  t.created_at,
  t.due_date,
  t.task_type,
  t.status,
  CASE
    WHEN t.meeting_action_item_id IS NOT NULL THEN 'AI Generated'
    ELSE 'Manual'
  END as source_type,
  mai.assignee_email as original_assignee_email,
  m.title as meeting_title,
  c.name as company_name
FROM tasks t
JOIN user_with_most_tasks uwmt ON t.assigned_to = uwmt.assigned_to
LEFT JOIN meeting_action_items mai ON t.meeting_action_item_id = mai.id
LEFT JOIN meetings m ON t.meeting_id = m.id
LEFT JOIN companies c ON t.company_id = c.id
WHERE t.status IN ('pending', 'in_progress', 'overdue')
ORDER BY t.created_at DESC
LIMIT 50;

-- Query 9: Check if tasks are being created by one user and assigned to another
SELECT
  creator.email as created_by_email,
  assignee.email as assigned_to_email,
  COUNT(*) as task_count,
  MIN(t.created_at) as first_created,
  MAX(t.created_at) as last_created
FROM tasks t
LEFT JOIN profiles creator ON t.created_by = creator.id
LEFT JOIN profiles assignee ON t.assigned_to = assignee.id
WHERE t.status IN ('pending', 'in_progress', 'overdue')
  AND t.created_at > NOW() - INTERVAL '6 months'
GROUP BY creator.email, assignee.email
ORDER BY task_count DESC
LIMIT 20;

-- Query 10: Action items waiting to be converted
SELECT
  COUNT(*) as total_action_items,
  COUNT(CASE WHEN synced_to_task = true THEN 1 END) as synced_to_tasks,
  COUNT(CASE WHEN synced_to_task = false THEN 1 END) as not_synced,
  COUNT(CASE WHEN sync_status = 'excluded' THEN 1 END) as excluded,
  COUNT(CASE WHEN assignee_email IS NULL THEN 1 END) as no_assignee
FROM meeting_action_items
WHERE created_at > NOW() - INTERVAL '6 months';

-- ============================================================================
-- SUMMARY: What to look for
-- ============================================================================
-- Query 1: Total tasks by status - baseline numbers
-- Query 2: WHO has the most tasks (should show you with 8000+)
-- Query 3: WHEN were tasks created (steady over time or sudden spike?)
-- Query 4: Due date patterns (are they mostly overdue? No due date?)
-- Query 5: WHERE tasks came from (AI? Manual? Deal?)
-- Query 6: What CATEGORIES of tasks
-- Query 7: Detailed breakdown for user with most tasks
-- Query 8: Sample tasks to see what they look like
-- Query 9: Check creator vs assignee pattern (assignment bug symptom)
-- Query 10: How many action items haven't been converted yet
-- ============================================================================
