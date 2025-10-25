-- Migration: Task Notification System
-- Description: Notify users of new tasks, upcoming deadlines, and overdue tasks
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- PHASE 1: Notification Helper Functions
-- ============================================================================

-- Function to create a task notification
CREATE OR REPLACE FUNCTION create_task_notification(
  p_user_id UUID,
  p_task_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    category,
    entity_type,
    entity_id,
    action_url,
    read,
    created_at
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    'task',
    'task',
    p_task_id,
    COALESCE(p_action_url, CONCAT('/crm/tasks?task_id=', p_task_id)),
    FALSE,
    NOW()
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 2: New Task from Meeting Action Item Notification
-- ============================================================================

-- Notify user when a task is created from a meeting action item
CREATE OR REPLACE FUNCTION notify_task_from_meeting()
RETURNS TRIGGER AS $$
DECLARE
  meeting_title TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Only notify if task was created from a meeting action item
  IF NEW.meeting_action_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get meeting title
  SELECT m.title INTO meeting_title
  FROM meetings m
  JOIN meeting_action_items mai ON mai.meeting_id = m.id
  WHERE mai.id = NEW.meeting_action_item_id;

  -- Build notification
  notification_title := 'New Action Item from Meeting';
  notification_message := CONCAT(
    'A new task "', NEW.title, '" has been assigned to you from the meeting "',
    COALESCE(meeting_title, 'Unknown Meeting'), '".',
    CASE
      WHEN NEW.due_date IS NOT NULL THEN CONCAT(' Due: ', TO_CHAR(NEW.due_date, 'Mon DD, YYYY'))
      ELSE ''
    END
  );

  -- Create notification
  PERFORM create_task_notification(
    NEW.assigned_to,
    NEW.id,
    notification_title,
    notification_message,
    CASE
      WHEN NEW.priority = 'urgent' THEN 'error'
      WHEN NEW.priority = 'high' THEN 'warning'
      ELSE 'info'
    END,
    CONCAT('/crm/tasks?task_id=', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_task_from_meeting ON tasks;
CREATE TRIGGER trigger_notify_task_from_meeting
  AFTER INSERT ON tasks
  FOR EACH ROW
  WHEN (NEW.meeting_action_item_id IS NOT NULL)
  EXECUTE FUNCTION notify_task_from_meeting();

-- ============================================================================
-- PHASE 3: Upcoming Task Deadline Notifications (1 Day Before)
-- ============================================================================

-- Function to send notifications for tasks due in 1 day
CREATE OR REPLACE FUNCTION notify_upcoming_task_deadlines()
RETURNS JSON AS $$
DECLARE
  task_record RECORD;
  notification_count INTEGER := 0;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Find all tasks due tomorrow (between 24 and 48 hours from now)
  FOR task_record IN
    SELECT
      t.id,
      t.title,
      t.assigned_to,
      t.due_date,
      t.priority,
      t.meeting_action_item_id,
      m.title as meeting_title
    FROM tasks t
    LEFT JOIN meeting_action_items mai ON mai.id = t.meeting_action_item_id
    LEFT JOIN meetings m ON m.id = mai.meeting_id
    WHERE
      t.completed = FALSE
      AND t.status NOT IN ('completed', 'cancelled')
      AND t.due_date IS NOT NULL
      AND t.due_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
      -- Don't notify if already notified in the last 12 hours
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.entity_id = t.id
          AND n.entity_type = 'task'
          AND n.title LIKE 'Task Due Tomorrow%'
          AND n.created_at > NOW() - INTERVAL '12 hours'
      )
  LOOP
    -- Build notification
    notification_title := 'Task Due Tomorrow';
    notification_message := CONCAT(
      'Your task "', task_record.title, '" is due tomorrow (',
      TO_CHAR(task_record.due_date, 'Mon DD, YYYY at HH12:MI AM'), ').',
      CASE
        WHEN task_record.meeting_title IS NOT NULL
        THEN CONCAT(' From meeting: ', task_record.meeting_title)
        ELSE ''
      END
    );

    -- Create notification
    PERFORM create_task_notification(
      task_record.assigned_to,
      task_record.id,
      notification_title,
      notification_message,
      CASE
        WHEN task_record.priority IN ('urgent', 'high') THEN 'warning'
        ELSE 'info'
      END,
      CONCAT('/crm/tasks?task_id=', task_record.id)
    );

    notification_count := notification_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'notifications_sent', notification_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 4: Overdue Task Notifications
-- ============================================================================

-- Function to send notifications for overdue tasks
CREATE OR REPLACE FUNCTION notify_overdue_tasks()
RETURNS JSON AS $$
DECLARE
  task_record RECORD;
  notification_count INTEGER := 0;
  notification_title TEXT;
  notification_message TEXT;
  days_overdue INTEGER;
BEGIN
  -- Find all overdue tasks (due date in the past)
  FOR task_record IN
    SELECT
      t.id,
      t.title,
      t.assigned_to,
      t.due_date,
      t.priority,
      t.meeting_action_item_id,
      m.title as meeting_title,
      EXTRACT(DAY FROM NOW() - t.due_date)::INTEGER as days_overdue
    FROM tasks t
    LEFT JOIN meeting_action_items mai ON mai.id = t.meeting_action_item_id
    LEFT JOIN meetings m ON m.id = mai.meeting_id
    WHERE
      t.completed = FALSE
      AND t.status NOT IN ('completed', 'cancelled')
      AND t.due_date IS NOT NULL
      AND t.due_date < NOW()
      -- Only notify once per day per task
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.entity_id = t.id
          AND n.entity_type = 'task'
          AND n.title LIKE 'Task Overdue%'
          AND n.created_at > NOW() - INTERVAL '23 hours'
      )
  LOOP
    days_overdue := task_record.days_overdue;

    -- Build notification
    notification_title := 'Task Overdue';
    notification_message := CONCAT(
      'Your task "', task_record.title, '" is ',
      CASE
        WHEN days_overdue = 0 THEN 'overdue (was due today)'
        WHEN days_overdue = 1 THEN '1 day overdue'
        ELSE CONCAT(days_overdue, ' days overdue')
      END,
      '.',
      CASE
        WHEN task_record.meeting_title IS NOT NULL
        THEN CONCAT(' From meeting: ', task_record.meeting_title)
        ELSE ''
      END
    );

    -- Create notification (always as error for overdue)
    PERFORM create_task_notification(
      task_record.assigned_to,
      task_record.id,
      notification_title,
      notification_message,
      'error',
      CONCAT('/crm/tasks?task_id=', task_record.id)
    );

    notification_count := notification_count + 1;

    -- Auto-update task status to overdue if not already
    UPDATE tasks
    SET status = 'overdue', updated_at = NOW()
    WHERE id = task_record.id AND status != 'overdue';

  END LOOP;

  RETURN json_build_object(
    'success', true,
    'notifications_sent', notification_count,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 5: Task Reassignment Notification
-- ============================================================================

-- Notify user when a task is reassigned to them
CREATE OR REPLACE FUNCTION notify_task_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  old_assignee_name TEXT;
  meeting_title TEXT;
BEGIN
  -- Only notify if assignee actually changed and it's not a new task
  IF NEW.assigned_to = OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Get old assignee name
  SELECT COALESCE(full_name, email) INTO old_assignee_name
  FROM auth.users
  WHERE id = OLD.assigned_to;

  -- Get meeting title if linked
  IF NEW.meeting_action_item_id IS NOT NULL THEN
    SELECT m.title INTO meeting_title
    FROM meetings m
    JOIN meeting_action_items mai ON mai.meeting_id = m.id
    WHERE mai.id = NEW.meeting_action_item_id;
  END IF;

  -- Build notification
  notification_title := 'Task Reassigned to You';
  notification_message := CONCAT(
    'The task "', NEW.title, '" has been reassigned to you',
    CASE
      WHEN old_assignee_name IS NOT NULL THEN CONCAT(' from ', old_assignee_name)
      ELSE ''
    END,
    '.',
    CASE
      WHEN NEW.due_date IS NOT NULL THEN CONCAT(' Due: ', TO_CHAR(NEW.due_date, 'Mon DD, YYYY'))
      ELSE ''
    END,
    CASE
      WHEN meeting_title IS NOT NULL THEN CONCAT(' (From meeting: ', meeting_title, ')')
      ELSE ''
    END
  );

  -- Create notification
  PERFORM create_task_notification(
    NEW.assigned_to,
    NEW.id,
    notification_title,
    notification_message,
    CASE
      WHEN NEW.priority IN ('urgent', 'high') THEN 'warning'
      ELSE 'info'
    END,
    CONCAT('/crm/tasks?task_id=', NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_task_reassignment ON tasks;
CREATE TRIGGER trigger_notify_task_reassignment
  AFTER UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION notify_task_reassignment();

-- ============================================================================
-- PHASE 6: Schedule Cron Jobs for Automated Notifications
-- ============================================================================

-- Note: These require pg_cron extension to be enabled
-- Run upcoming deadline notifications every day at 9 AM
-- SELECT cron.schedule(
--   'notify-upcoming-task-deadlines',
--   '0 9 * * *',
--   $$SELECT notify_upcoming_task_deadlines()$$
-- );

-- Run overdue task notifications every day at 9 AM and 5 PM
-- SELECT cron.schedule(
--   'notify-overdue-tasks-morning',
--   '0 9 * * *',
--   $$SELECT notify_overdue_tasks()$$
-- );

-- SELECT cron.schedule(
--   'notify-overdue-tasks-evening',
--   '0 17 * * *',
--   $$SELECT notify_overdue_tasks()$$
-- );

-- ============================================================================
-- PHASE 7: Manual Notification Trigger Functions
-- ============================================================================

-- Function to manually trigger all task notifications for testing
CREATE OR REPLACE FUNCTION trigger_all_task_notifications()
RETURNS JSON AS $$
DECLARE
  upcoming_result JSON;
  overdue_result JSON;
BEGIN
  -- Send upcoming deadline notifications
  SELECT notify_upcoming_task_deadlines() INTO upcoming_result;

  -- Send overdue task notifications
  SELECT notify_overdue_tasks() INTO overdue_result;

  RETURN json_build_object(
    'success', true,
    'upcoming_deadlines', upcoming_result,
    'overdue_tasks', overdue_result,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 8: Add helpful comments
-- ============================================================================

COMMENT ON FUNCTION create_task_notification IS 'Helper function to create task-related notifications';
COMMENT ON FUNCTION notify_task_from_meeting IS 'Trigger function: Notify user when task is created from meeting action item';
COMMENT ON FUNCTION notify_upcoming_task_deadlines IS 'Scheduled function: Send notifications for tasks due in 24 hours';
COMMENT ON FUNCTION notify_overdue_tasks IS 'Scheduled function: Send notifications for overdue tasks';
COMMENT ON FUNCTION notify_task_reassignment IS 'Trigger function: Notify user when task is reassigned to them';
COMMENT ON FUNCTION trigger_all_task_notifications IS 'Manual trigger: Run all task notification checks (for testing)';

-- ============================================================================
-- PHASE 9: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_task_notification TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION notify_upcoming_task_deadlines TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION notify_overdue_tasks TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION trigger_all_task_notifications TO authenticated, service_role;
