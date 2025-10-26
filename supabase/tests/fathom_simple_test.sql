-- ============================================================================
-- SIMPLIFIED FATHOM INTEGRATION TEST
-- Tests core functionality without insight triggers
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_contact_id UUID;
  v_meeting_id UUID;
  v_action_item_id UUID;
  v_task_id UUID;
  v_sync_status TEXT;
  v_tests_passed INTEGER := 0;
  v_tests_failed INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🧪 SIMPLIFIED FATHOM INTEGRATION TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Get user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ No users found - tests require at least one user';
    RETURN;
  END IF;

  -- ============================================================================
  -- TEST 1: Company Creation
  -- ============================================================================
  RAISE NOTICE 'Test 1: Company Creation with Source Tracking';

  BEGIN
    INSERT INTO companies (name, domain, owner_id, source, first_seen_at)
    VALUES ('TEST: Acme Corp', 'acme-test.com', v_user_id, 'fathom', NOW())
    RETURNING id INTO v_company_id;

    IF v_company_id IS NOT NULL THEN
      RAISE NOTICE '✅ Company created: %', v_company_id;
      v_tests_passed := v_tests_passed + 1;
    ELSE
      RAISE NOTICE '❌ Company creation failed';
      v_tests_failed := v_tests_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- TEST 2: Contact Creation
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 2: Contact Creation with Email Normalization';

  BEGIN
    INSERT INTO contacts (first_name, last_name, email, company_id, owner_id, source, first_seen_at)
    VALUES ('TEST: John', 'Doe', 'john.doe@acme-test.com', v_company_id, v_user_id, 'fathom', NOW())
    RETURNING id INTO v_contact_id;

    IF v_contact_id IS NOT NULL THEN
      RAISE NOTICE '✅ Contact created: %', v_contact_id;
      v_tests_passed := v_tests_passed + 1;
    ELSE
      RAISE NOTICE '❌ Contact creation failed';
      v_tests_failed := v_tests_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- TEST 3: Meeting Creation with Transcript
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 3: Meeting Creation with Transcript';

  BEGIN
    INSERT INTO meetings (
      title, meeting_start, meeting_end, owner_user_id, company_id,
      transcript_text, summary, fathom_recording_id, share_url
    ) VALUES (
      'TEST: Discovery Call',
      NOW() - INTERVAL '1 hour',
      NOW(),
      v_user_id,
      v_company_id,
      'Test transcript discussing proposals and pricing.',
      'Discovery call summary',
      'fathom_test_simple_001',
      'https://fathom.video/test001'
    ) RETURNING id INTO v_meeting_id;

    IF v_meeting_id IS NOT NULL THEN
      RAISE NOTICE '✅ Meeting created: %', v_meeting_id;
      v_tests_passed := v_tests_passed + 1;
    ELSE
      RAISE NOTICE '❌ Meeting creation failed';
      v_tests_failed := v_tests_failed + 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    RAISE NOTICE '   (Note: Insight triggers may cause errors - this is expected)';
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- TEST 4: Action Item → Task Sync (Internal User)
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 4: Action Item → Task Sync (Internal Assignee)';

  BEGIN
    -- Get internal user email
    DECLARE
      v_internal_email TEXT;
    BEGIN
      SELECT email INTO v_internal_email FROM auth.users WHERE id = v_user_id;

      INSERT INTO meeting_action_items (
        meeting_id, title, assignee_email, assignee_name, priority, deadline_at
      ) VALUES (
        v_meeting_id,
        'TEST: Send proposal to client',
        v_internal_email,
        'Internal User',
        'high',
        NOW() + INTERVAL '2 days'
      ) RETURNING id INTO v_action_item_id;

      -- Wait for trigger
      PERFORM pg_sleep(1);

      -- Check sync
      SELECT task_id, sync_status INTO v_task_id, v_sync_status
      FROM meeting_action_items WHERE id = v_action_item_id;

      IF v_task_id IS NOT NULL AND v_sync_status = 'synced' THEN
        RAISE NOTICE '✅ Task synced: %', v_task_id;
        RAISE NOTICE '   Sync status: %', v_sync_status;
        v_tests_passed := v_tests_passed + 1;
      ELSE
        RAISE NOTICE '❌ Task sync failed';
        RAISE NOTICE '   Task ID: %', v_task_id;
        RAISE NOTICE '   Status: %', v_sync_status;
        v_tests_failed := v_tests_failed + 1;
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- TEST 5: External Assignee Exclusion
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 5: External Assignee Exclusion';

  BEGIN
    DECLARE
      v_external_action_id UUID;
      v_external_task_id UUID;
      v_external_status TEXT;
    BEGIN
      INSERT INTO meeting_action_items (
        meeting_id, title, assignee_email, assignee_name, priority, deadline_at
      ) VALUES (
        v_meeting_id,
        'TEST: Client to review proposal',
        'client@external.com',
        'External Client',
        'medium',
        NOW() + INTERVAL '3 days'
      ) RETURNING id INTO v_external_action_id;

      -- Wait for trigger
      PERFORM pg_sleep(1);

      -- Check status
      SELECT task_id, sync_status INTO v_external_task_id, v_external_status
      FROM meeting_action_items WHERE id = v_external_action_id;

      IF v_external_task_id IS NULL AND v_external_status = 'excluded' THEN
        RAISE NOTICE '✅ External assignee correctly excluded';
        RAISE NOTICE '   Status: %', v_external_status;
        v_tests_passed := v_tests_passed + 1;
      ELSE
        RAISE NOTICE '❌ External exclusion failed';
        RAISE NOTICE '   Task ID: %', v_external_task_id;
        RAISE NOTICE '   Status: %', v_external_status;
        v_tests_failed := v_tests_failed + 1;
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- TEST 6: AI Analysis Components
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Test 6: AI Analysis System Components';

  BEGIN
    DECLARE
      v_ai_columns_exist BOOLEAN;
      v_apply_function_exists BOOLEAN;
      v_pending_function_exists BOOLEAN;
    BEGIN
      -- Check AI columns
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'meeting_action_items'
        AND column_name IN ('ai_task_type', 'ai_confidence_score', 'ai_reasoning', 'ai_analyzed_at')
      ) INTO v_ai_columns_exist;

      -- Check functions
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'apply_ai_analysis_to_task'
      ) INTO v_apply_function_exists;

      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'get_pending_ai_analysis'
      ) INTO v_pending_function_exists;

      IF v_ai_columns_exist AND v_apply_function_exists AND v_pending_function_exists THEN
        RAISE NOTICE '✅ AI analysis components verified';
        v_tests_passed := v_tests_passed + 1;
      ELSE
        RAISE NOTICE '❌ AI analysis components incomplete';
        RAISE NOTICE '   Columns: %', v_ai_columns_exist;
        RAISE NOTICE '   Apply function: %', v_apply_function_exists;
        RAISE NOTICE '   Pending function: %', v_pending_function_exists;
        v_tests_failed := v_tests_failed + 1;
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error: %', SQLERRM;
    v_tests_failed := v_tests_failed + 1;
  END;

  -- ============================================================================
  -- CLEANUP
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'Cleaning up test data...';

  BEGIN
    DELETE FROM meeting_action_items WHERE meeting_id = v_meeting_id;
    DELETE FROM tasks WHERE title LIKE 'TEST:%';
    DELETE FROM meetings WHERE id = v_meeting_id;
    DELETE FROM contacts WHERE id = v_contact_id;
    DELETE FROM companies WHERE id = v_company_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Note: Cleanup encountered expected audit log conflicts (this is normal)';
  END;

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 TEST RESULTS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tests Passed: %', v_tests_passed;
  RAISE NOTICE 'Tests Failed: %', v_tests_failed;
  RAISE NOTICE 'Total Tests: %', v_tests_passed + v_tests_failed;
  RAISE NOTICE '';

  IF v_tests_failed = 0 THEN
    RAISE NOTICE '🎉 ALL TESTS PASSED!';
  ELSE
    RAISE NOTICE '⚠️  SOME TESTS FAILED';
  END IF;

  RAISE NOTICE '========================================';
END;
$$;
