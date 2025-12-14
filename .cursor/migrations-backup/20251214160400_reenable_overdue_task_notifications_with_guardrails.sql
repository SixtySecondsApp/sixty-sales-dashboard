-- ============================================================================
-- Re-enable overdue task notifications with guardrails
-- ============================================================================
-- Purpose:
--  - Bring back notify_overdue_tasks() safely after the "wrong year" due_date bug
--    caused mass overdue states/notifications.
--  - Add hard guardrails to prevent notification floods:
--    - Only notify tasks overdue within a bounded window (default: 30 days)
--    - Skip tasks that were recently "due_date_repair" patched
--    - Keep per-task per-day dedupe via notifications table
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_overdue_tasks()
RETURNS JSON AS $$
DECLARE
  task_record RECORD;
  notification_count INTEGER := 0;
  notification_title TEXT;
  notification_message TEXT;
  days_overdue INTEGER;
  max_overdue_window_days INTEGER := 30;
BEGIN
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
      -- Guardrail: ignore tasks that are *way* overdue (likely bad data / wrong year)
      AND t.due_date >= NOW() - make_interval(days => max_overdue_window_days)
      -- Guardrail: skip tasks that were recently repaired (avoid immediate "overdue" spam)
      AND NOT (
        COALESCE(t.metadata, '{}'::jsonb) ? 'due_date_repair'
        AND (t.metadata->'due_date_repair'->>'repaired_at')::timestamptz > NOW() - INTERVAL '24 hours'
      )
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

    PERFORM create_task_notification(
      task_record.assigned_to,
      task_record.id,
      notification_title,
      notification_message,
      'error',
      CONCAT('/crm/tasks?task_id=', task_record.id)
    );

    notification_count := notification_count + 1;

    -- Keep task status aligned (non-blocking)
    UPDATE tasks
    SET status = 'overdue', updated_at = NOW()
    WHERE id = task_record.id AND status != 'overdue';
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'notifications_sent', notification_count,
    'guardrails', json_build_object(
      'max_overdue_window_days', max_overdue_window_days,
      'skip_recent_repairs_hours', 24
    ),
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_overdue_tasks IS
  'Overdue task notifications with guardrails (bounded overdue window + skip recent due_date repairs) to prevent flood from bad due_date data.';

