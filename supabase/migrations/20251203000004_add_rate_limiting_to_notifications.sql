-- ============================================================================
-- Apply Rate Limiting to Notification Creation
-- ============================================================================
-- Purpose: Update create_task_notification() to enforce rate limits
-- Date: 2025-12-03
-- Part of: Notification flood prevention system (Phase 4.2)
-- Dependencies: 20251203000003_add_notification_rate_limiting.sql
-- ============================================================================

-- Step 1: Update create_task_notification to check rate limits before creating
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
  can_create BOOLEAN;
  notification_type_key TEXT;
BEGIN
  -- Build notification type key for rate limiting
  -- Format: "type_category" (e.g., "error_task", "warning_task", "info_task")
  notification_type_key := CONCAT(p_type, '_task');

  -- Check rate limits before creating notification
  -- Default limits: 10 per hour, 50 per day
  can_create := should_create_notification(
    p_user_id,
    notification_type_key,
    10,  -- max per hour
    50   -- max per day
  );

  -- If rate limit exceeded, log and return NULL
  IF NOT can_create THEN
    RAISE NOTICE 'Rate limit exceeded for user % notification type %. Notification not created: "%"',
      p_user_id, notification_type_key, p_title;
    RETURN NULL;
  END IF;

  -- Rate limit OK, create notification
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

-- Update function comment to reflect rate limiting
COMMENT ON FUNCTION create_task_notification IS
  'Helper function to create task-related notifications. ' ||
  'RATE LIMITED: Max 10 per hour, 50 per day per user per notification type. ' ||
  'Returns notification ID on success, NULL if rate limit exceeded.';

-- ============================================================================
-- Step 2: Update notification triggers to handle NULL returns gracefully
-- ============================================================================

-- Update notify_task_from_meeting to handle rate-limited notifications
CREATE OR REPLACE FUNCTION notify_task_from_meeting()
RETURNS TRIGGER AS $$
DECLARE
  meeting_title TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_id UUID;
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

  -- Create notification (may be NULL if rate limited)
  SELECT create_task_notification(
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
  ) INTO notification_id;

  -- Log if notification was rate limited
  IF notification_id IS NULL THEN
    RAISE NOTICE 'Meeting task notification rate limited for user % task %',
      NEW.assigned_to, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update notify_task_reassignment to handle rate-limited notifications
CREATE OR REPLACE FUNCTION notify_task_reassignment()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  old_assignee_name TEXT;
  meeting_title TEXT;
  notification_id UUID;
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

  -- Create notification (may be NULL if rate limited)
  SELECT create_task_notification(
    NEW.assigned_to,
    NEW.id,
    notification_title,
    notification_message,
    CASE
      WHEN NEW.priority IN ('urgent', 'high') THEN 'warning'
      ELSE 'info'
    END,
    CONCAT('/crm/tasks?task_id=', NEW.id)
  ) INTO notification_id;

  -- Log if notification was rate limited
  IF notification_id IS NULL THEN
    RAISE NOTICE 'Task reassignment notification rate limited for user % task %',
      NEW.assigned_to, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update function comments to reflect rate limiting
COMMENT ON FUNCTION notify_task_from_meeting IS
  'Trigger function: Notify user when task is created from meeting action item. ' ||
  'RATE LIMITED: May skip notification if user rate limit exceeded.';

COMMENT ON FUNCTION notify_task_reassignment IS
  'Trigger function: Notify user when task is reassigned to them. ' ||
  'RATE LIMITED: May skip notification if user rate limit exceeded.';

-- ============================================================================
-- Step 3: Verification and Testing
-- ============================================================================
DO $$
DECLARE
  test_user_id UUID;
  test_task_id UUID;
  notification_id UUID;
  i INTEGER;
  created_count INTEGER := 0;
  blocked_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing Rate-Limited Notifications:';
  RAISE NOTICE '========================================';

  -- Get a test user
  SELECT id INTO test_user_id
  FROM auth.users
  LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  No users found for testing, skipping rate limit test';
    RETURN;
  END IF;

  -- Get a test task
  SELECT id INTO test_task_id
  FROM tasks
  WHERE assigned_to = test_user_id
  LIMIT 1;

  IF test_task_id IS NULL THEN
    RAISE NOTICE '⚠️  No tasks found for test user, skipping notification test';
    RETURN;
  END IF;

  RAISE NOTICE 'Test User: %', test_user_id;
  RAISE NOTICE 'Test Task: %', test_task_id;
  RAISE NOTICE '========================================';

  -- Test: Create notifications up to limit (should create 10, block rest)
  FOR i IN 1..15 LOOP
    SELECT create_task_notification(
      test_user_id,
      test_task_id,
      CONCAT('Test Notification ', i),
      CONCAT('Testing rate limiting - notification ', i),
      'info'
    ) INTO notification_id;

    IF notification_id IS NOT NULL THEN
      created_count := created_count + 1;
      RAISE NOTICE '✅ Notification % created (ID: %)', i, notification_id;
    ELSE
      blocked_count := blocked_count + 1;
      RAISE NOTICE '🚫 Notification % blocked by rate limit', i;
    END IF;
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rate Limiting Test Results:';
  RAISE NOTICE '  Created: % notifications', created_count;
  RAISE NOTICE '  Blocked: % notifications', blocked_count;
  RAISE NOTICE '========================================';

  -- Verify expected behavior
  IF created_count = 10 AND blocked_count = 5 THEN
    RAISE NOTICE '✅ SUCCESS: Rate limiting working correctly';
    RAISE NOTICE '✅ Hourly limit (10) enforced properly';
  ELSE
    RAISE WARNING '❌ WARNING: Unexpected rate limiting behavior';
    RAISE WARNING '  Expected: 10 created, 5 blocked';
    RAISE WARNING '  Actual: % created, % blocked', created_count, blocked_count;
  END IF;

  -- Clean up test notifications and rate limits
  DELETE FROM notifications
  WHERE user_id = test_user_id
    AND title LIKE 'Test Notification %';

  DELETE FROM notification_rate_limits
  WHERE user_id = test_user_id
    AND notification_type = 'info_task';

  RAISE NOTICE '✅ Test data cleaned up';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- Step 4: Show rate limiting status
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rate Limiting Applied Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Function: create_task_notification()';
  RAISE NOTICE '  Hourly Limit: 10 notifications per user';
  RAISE NOTICE '  Daily Limit: 50 notifications per user';
  RAISE NOTICE '  Per Type: Limits apply per notification type';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated Triggers:';
  RAISE NOTICE '  ✅ notify_task_from_meeting';
  RAISE NOTICE '  ✅ notify_task_reassignment';
  RAISE NOTICE '';
  RAISE NOTICE 'Behavior:';
  RAISE NOTICE '  - Returns NULL if rate limit exceeded';
  RAISE NOTICE '  - Logs rate limit events to server logs';
  RAISE NOTICE '  - Triggers handle NULL gracefully';
  RAISE NOTICE '========================================';
END $$;
