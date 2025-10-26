-- Test AI Analysis - Manual Trigger
-- This tests the AI analysis by calling the edge function directly

DO $$
DECLARE
  v_action_item_id UUID;
  v_test_result JSON;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🧪 Testing AI Analysis';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Get the action item ID you created
  SELECT id INTO v_action_item_id
  FROM meeting_action_items
  WHERE title = 'Send pricing proposal to Acme Corp'
  LIMIT 1;

  IF v_action_item_id IS NULL THEN
    RAISE NOTICE '❌ Action item not found';
    RAISE NOTICE 'Create one first with:';
    RAISE NOTICE 'INSERT INTO meeting_action_items (meeting_id, title, assignee_email, priority, deadline_at)';
    RAISE NOTICE 'SELECT id, ''Send pricing proposal to Acme Corp'', ''test@example.com'', ''high'', NOW() + INTERVAL ''3 days''';
    RAISE NOTICE 'FROM meetings LIMIT 1;';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Found action item: %', v_action_item_id;
  RAISE NOTICE '';

  -- Check if it already has AI analysis
  SELECT json_build_object(
    'ai_task_type', ai_task_type,
    'ai_confidence_score', ai_confidence_score,
    'ai_reasoning', LEFT(COALESCE(ai_reasoning, ''), 100)
  ) INTO v_test_result
  FROM meeting_action_items
  WHERE id = v_action_item_id;

  IF (v_test_result->>'ai_task_type') IS NOT NULL THEN
    RAISE NOTICE '✅ AI Analysis Already Complete:';
    RAISE NOTICE '   Task Type: %', v_test_result->>'ai_task_type';
    RAISE NOTICE '   Confidence: %', v_test_result->>'ai_confidence_score';
    RAISE NOTICE '   Reasoning: %...', v_test_result->>'ai_reasoning';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 AI Analysis is working!';
  ELSE
    RAISE NOTICE '⏳ No AI analysis yet';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '1. The AI analysis runs asynchronously via Edge Function';
    RAISE NOTICE '2. Call the edge function manually:';
    RAISE NOTICE '';
    RAISE NOTICE 'curl -X POST ''https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/analyze-action-item'' \';
    RAISE NOTICE '  -H ''Authorization: Bearer YOUR_SERVICE_ROLE_KEY'' \';
    RAISE NOTICE '  -H ''Content-Type: application/json'' \';
    RAISE NOTICE '  -d ''{"action_item_id": "%"}''', v_action_item_id;
    RAISE NOTICE '';
    RAISE NOTICE '3. Or use the simpler approach - query pending items:';
    RAISE NOTICE 'SELECT * FROM get_pending_ai_analysis();';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
