-- Test AI Analysis with Internal User
-- This will actually create a task and trigger AI analysis

DO $$
DECLARE
  v_internal_email TEXT;
  v_meeting_id UUID;
  v_action_item_id UUID;
  v_task_id UUID;
  v_sync_status TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🧪 Testing with Internal User';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Get an internal user email
  SELECT email INTO v_internal_email
  FROM auth.users
  LIMIT 1;

  IF v_internal_email IS NULL THEN
    RAISE NOTICE '❌ No users found in auth.users';
    RAISE NOTICE 'You need at least one user in the system to test';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found internal user: %', v_internal_email;
  RAISE NOTICE '';

  -- Get a meeting
  SELECT id INTO v_meeting_id
  FROM meetings
  LIMIT 1;

  IF v_meeting_id IS NULL THEN
    RAISE NOTICE '❌ No meetings found';
    RAISE NOTICE 'Create a meeting first to test';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found meeting: %', v_meeting_id;
  RAISE NOTICE '';

  -- Clean up any existing test items
  DELETE FROM meeting_action_items
  WHERE title = 'TEST: Send pricing proposal to Acme Corp';

  RAISE NOTICE '📋 Creating test action item...';
  RAISE NOTICE '   Title: TEST: Send pricing proposal to Acme Corp';
  RAISE NOTICE '   Assignee: % (internal user)', v_internal_email;
  RAISE NOTICE '';

  -- Create action item with INTERNAL user
  INSERT INTO meeting_action_items (
    meeting_id,
    title,
    assignee_email,
    priority,
    deadline_at
  ) VALUES (
    v_meeting_id,
    'TEST: Send pricing proposal to Acme Corp',
    v_internal_email,  -- Internal user!
    'high',
    NOW() + INTERVAL '3 days'
  )
  RETURNING id INTO v_action_item_id;

  RAISE NOTICE '✅ Action item created: %', v_action_item_id;
  RAISE NOTICE '';

  -- Wait a moment for trigger to fire
  PERFORM pg_sleep(1);

  -- Check sync status
  SELECT sync_status, task_id INTO v_sync_status, v_task_id
  FROM meeting_action_items
  WHERE id = v_action_item_id;

  RAISE NOTICE '📊 Results:';
  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE 'Sync Status: %', v_sync_status;
  RAISE NOTICE 'Task Created: %', CASE WHEN v_task_id IS NOT NULL THEN 'YES ✅' ELSE 'NO ❌' END;
  IF v_task_id IS NOT NULL THEN
    RAISE NOTICE 'Task ID: %', v_task_id;
  END IF;
  RAISE NOTICE '';

  IF v_sync_status = 'synced' AND v_task_id IS NOT NULL THEN
    RAISE NOTICE '🎉 SUCCESS! Task was created and synced!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Check the task:';
    RAISE NOTICE 'SELECT * FROM tasks WHERE id = ''%'';', v_task_id;
    RAISE NOTICE '';
    RAISE NOTICE '🤖 AI Analysis Status:';
    RAISE NOTICE 'The AI analysis runs asynchronously.';
    RAISE NOTICE 'To see if it ran, check:';
    RAISE NOTICE 'SELECT ai_task_type, ai_confidence_score, ai_reasoning';
    RAISE NOTICE 'FROM meeting_action_items WHERE id = ''%'';', v_action_item_id;
    RAISE NOTICE '';
    RAISE NOTICE 'If ai_task_type is NULL, the AI hasnt run yet.';
    RAISE NOTICE 'Trigger it manually with:';
    RAISE NOTICE 'SELECT * FROM get_pending_ai_analysis();';
  ELSE
    RAISE NOTICE '❌ FAILED: Task was not created';
    RAISE NOTICE 'Sync Status: %', v_sync_status;
    RAISE NOTICE '';
    RAISE NOTICE 'Check for errors:';
    RAISE NOTICE 'SELECT sync_error FROM meeting_action_items WHERE id = ''%'';', v_action_item_id;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
