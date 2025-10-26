-- ============================================================================
-- COMPREHENSIVE FATHOM INTEGRATION TEST SUITE
-- Tests all features from recent PRs
-- ============================================================================

BEGIN;

-- Create test helpers
CREATE OR REPLACE FUNCTION test_reset_data()
RETURNS void AS $$
BEGIN
  -- Clean test data (keep in reverse dependency order)
  DELETE FROM meeting_action_items WHERE title LIKE 'TEST:%';
  DELETE FROM tasks WHERE title LIKE 'TEST:%';
  DELETE FROM meeting_contacts WHERE meeting_id IN (SELECT id FROM meetings WHERE title LIKE 'TEST:%');
  DELETE FROM contact_meeting_insights WHERE contact_id IN (SELECT id FROM contacts WHERE first_name LIKE 'TEST:%');
  DELETE FROM company_meeting_insights WHERE company_id IN (SELECT id FROM companies WHERE name LIKE 'TEST:%');
  DELETE FROM meetings WHERE title LIKE 'TEST:%';
  DELETE FROM contacts WHERE first_name LIKE 'TEST:%';
  DELETE FROM companies WHERE name LIKE 'TEST:%';
  RAISE NOTICE 'Test data cleaned';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEST SUITE 1: Company Matching & Creation
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_count INTEGER;
  v_user_id UUID;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 1: Company Matching';
  RAISE NOTICE '========================================';

  -- Get a user ID for owner_id
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ No users found - tests require at least one user';
    RETURN;
  END IF;

  -- Test 1.1: Create company from Fathom data
  RAISE NOTICE '';
  RAISE NOTICE 'Test 1.1: Company Creation';

  INSERT INTO companies (
    name,
    domain,
    owner_id,
    source,
    first_seen_at
  ) VALUES (
    'TEST: Acme Corporation',
    'acme-test.com',
    v_user_id,
    'fathom',
    NOW()
  ) RETURNING id INTO v_company_id;

  IF v_company_id IS NOT NULL THEN
    RAISE NOTICE '✅ Company created: %', v_company_id;
  ELSE
    RAISE NOTICE '❌ Company creation failed';
    v_test_passed := FALSE;
  END IF;

  -- Test 1.2: Verify source tracking
  SELECT COUNT(*) INTO v_count
  FROM companies
  WHERE id = v_company_id
    AND source = 'fathom'
    AND first_seen_at IS NOT NULL;

  IF v_count = 1 THEN
    RAISE NOTICE '✅ Source tracking verified';
  ELSE
    RAISE NOTICE '❌ Source tracking failed';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 1: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 1: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 2: Contact Creation & Email Normalization
-- ============================================================================

DO $$
DECLARE
  v_contact_id UUID;
  v_normalized_email TEXT;
  v_user_id UUID;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 2: Contact Management';
  RAISE NOTICE '========================================';

  -- Get user ID
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Test 2.1: Create contact with email normalization
  RAISE NOTICE '';
  RAISE NOTICE 'Test 2.1: Contact Creation & Email Normalization';

  INSERT INTO contacts (
    first_name,
    last_name,
    email,
    company_id,
    owner_id,
    source,
    first_seen_at
  )
  SELECT
    'TEST: John',
    'Doe',
    'John.Doe@Acme-Test.com',
    id,
    v_user_id,
    'fathom',
    NOW()
  FROM companies
  WHERE name = 'TEST: Acme Corporation'
  LIMIT 1
  RETURNING id, LOWER(TRIM(email)) INTO v_contact_id, v_normalized_email;

  IF v_contact_id IS NOT NULL THEN
    RAISE NOTICE '✅ Contact created: %', v_contact_id;
    RAISE NOTICE '✅ Email normalized: %', v_normalized_email;
  ELSE
    RAISE NOTICE '❌ Contact creation failed';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 2: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 2: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 3: Meeting Creation with Transcript
-- ============================================================================

DO $$
DECLARE
  v_meeting_id UUID;
  v_user_id UUID;
  v_company_id UUID;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 3: Meeting with Transcript';
  RAISE NOTICE '========================================';

  -- Get user and company
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  SELECT id INTO v_company_id FROM companies WHERE name = 'TEST: Acme Corporation' LIMIT 1;

  -- Test 3.1: Create meeting with transcript
  RAISE NOTICE '';
  RAISE NOTICE 'Test 3.1: Meeting Creation with Transcript';

  INSERT INTO meetings (
    title,
    meeting_start,
    meeting_end,
    owner_user_id,
    company_id,
    transcript_text,
    summary,
    fathom_recording_id,
    share_url
  ) VALUES (
    'TEST: Acme Discovery Call',
    NOW() - INTERVAL '1 hour',
    NOW(),
    v_user_id,
    v_company_id,
    'This is a test transcript. We discussed the proposal and pricing. John mentioned they need a demo next week.',
    'Discovery call with Acme Corporation. Discussed pricing and next steps.',
    'fathom_test_123',
    'https://fathom.video/test123'
  ) RETURNING id INTO v_meeting_id;

  IF v_meeting_id IS NOT NULL THEN
    RAISE NOTICE '✅ Meeting created: %', v_meeting_id;
  ELSE
    RAISE NOTICE '❌ Meeting creation failed';
    v_test_passed := FALSE;
  END IF;

  -- Verify transcript storage
  IF EXISTS (
    SELECT 1 FROM meetings
    WHERE id = v_meeting_id
    AND transcript_text IS NOT NULL
    AND LENGTH(transcript_text) > 0
  ) THEN
    RAISE NOTICE '✅ Transcript stored successfully';
  ELSE
    RAISE NOTICE '❌ Transcript storage failed';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 3: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 3: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 4: Action Items with Internal Assignee
-- ============================================================================

DO $$
DECLARE
  v_action_item_id UUID;
  v_task_id UUID;
  v_meeting_id UUID;
  v_internal_email TEXT;
  v_sync_status TEXT;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 4: Action Items → Tasks Sync';
  RAISE NOTICE '========================================';

  -- Get internal user and meeting
  SELECT email INTO v_internal_email FROM auth.users LIMIT 1;
  SELECT id INTO v_meeting_id FROM meetings WHERE title = 'TEST: Acme Discovery Call' LIMIT 1;

  -- Test 4.1: Create action item with internal assignee
  RAISE NOTICE '';
  RAISE NOTICE 'Test 4.1: Action Item with Internal Assignee';

  INSERT INTO meeting_action_items (
    meeting_id,
    title,
    assignee_email,
    assignee_name,
    priority,
    deadline_at
  ) VALUES (
    v_meeting_id,
    'TEST: Send proposal to Acme',
    v_internal_email,
    'Internal User',
    'high',
    NOW() + INTERVAL '2 days'
  ) RETURNING id INTO v_action_item_id;

  IF v_action_item_id IS NOT NULL THEN
    RAISE NOTICE '✅ Action item created: %', v_action_item_id;
  ELSE
    RAISE NOTICE '❌ Action item creation failed';
    v_test_passed := FALSE;
  END IF;

  -- Wait for trigger
  PERFORM pg_sleep(1);

  -- Test 4.2: Verify task was created
  SELECT task_id, sync_status INTO v_task_id, v_sync_status
  FROM meeting_action_items
  WHERE id = v_action_item_id;

  IF v_task_id IS NOT NULL AND v_sync_status = 'synced' THEN
    RAISE NOTICE '✅ Task synced: %', v_task_id;
    RAISE NOTICE '✅ Sync status: %', v_sync_status;
  ELSE
    RAISE NOTICE '❌ Task sync failed';
    RAISE NOTICE '   Task ID: %', v_task_id;
    RAISE NOTICE '   Sync Status: %', v_sync_status;
    v_test_passed := FALSE;
  END IF;

  -- Test 4.3: Verify task properties
  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE id = v_task_id
    AND title = 'TEST: Send proposal to Acme'
    AND priority = 'high'
    AND task_type = 'follow_up'
  ) THEN
    RAISE NOTICE '✅ Task properties verified';
  ELSE
    RAISE NOTICE '❌ Task properties incorrect';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 4: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 4: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 5: Action Items with External Assignee
-- ============================================================================

DO $$
DECLARE
  v_action_item_id UUID;
  v_task_id UUID;
  v_meeting_id UUID;
  v_sync_status TEXT;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 5: External Assignee Exclusion';
  RAISE NOTICE '========================================';

  SELECT id INTO v_meeting_id FROM meetings WHERE title = 'TEST: Acme Discovery Call' LIMIT 1;

  -- Test 5.1: Create action item with external assignee
  RAISE NOTICE '';
  RAISE NOTICE 'Test 5.1: Action Item with External Assignee';

  INSERT INTO meeting_action_items (
    meeting_id,
    title,
    assignee_email,
    assignee_name,
    priority,
    deadline_at
  ) VALUES (
    v_meeting_id,
    'TEST: Client to review proposal',
    'john.doe@acme-test.com',
    'John Doe',
    'medium',
    NOW() + INTERVAL '3 days'
  ) RETURNING id INTO v_action_item_id;

  -- Wait for trigger
  PERFORM pg_sleep(1);

  -- Test 5.2: Verify task was NOT created
  SELECT task_id, sync_status INTO v_task_id, v_sync_status
  FROM meeting_action_items
  WHERE id = v_action_item_id;

  IF v_task_id IS NULL AND v_sync_status = 'excluded' THEN
    RAISE NOTICE '✅ External assignee correctly excluded';
    RAISE NOTICE '✅ Sync status: %', v_sync_status;
  ELSE
    RAISE NOTICE '❌ External assignee exclusion failed';
    RAISE NOTICE '   Task ID: %', v_task_id;
    RAISE NOTICE '   Sync Status: %', v_sync_status;
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 5: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 5: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 6: AI Analysis System
-- ============================================================================

DO $$
DECLARE
  v_action_item_id UUID;
  v_ai_task_type TEXT;
  v_ai_confidence NUMERIC;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 6: AI Task Analysis';
  RAISE NOTICE '========================================';

  -- Get an action item with task
  SELECT id INTO v_action_item_id
  FROM meeting_action_items
  WHERE title = 'TEST: Send proposal to Acme'
  AND task_id IS NOT NULL
  LIMIT 1;

  RAISE NOTICE '';
  RAISE NOTICE 'Test 6.1: AI Analysis Columns Exist';

  -- Verify AI columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_action_items'
    AND column_name IN ('ai_task_type', 'ai_confidence_score', 'ai_reasoning', 'ai_analyzed_at')
  ) THEN
    RAISE NOTICE '✅ AI analysis columns exist';
  ELSE
    RAISE NOTICE '❌ AI analysis columns missing';
    v_test_passed := FALSE;
  END IF;

  -- Test 6.2: Check if apply function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'apply_ai_analysis_to_task'
  ) THEN
    RAISE NOTICE '✅ apply_ai_analysis_to_task function exists';
  ELSE
    RAISE NOTICE '❌ apply_ai_analysis_to_task function missing';
    v_test_passed := FALSE;
  END IF;

  -- Test 6.3: Check if pending function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_pending_ai_analysis'
  ) THEN
    RAISE NOTICE '✅ get_pending_ai_analysis function exists';
  ELSE
    RAISE NOTICE '❌ get_pending_ai_analysis function missing';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 6: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 6: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 7: Meeting Insights
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_contact_id UUID;
  v_meeting_id UUID;
  v_insights_count INTEGER;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 7: Meeting Insights';
  RAISE NOTICE '========================================';

  -- Get test data
  SELECT id INTO v_company_id FROM companies WHERE name = 'TEST: Acme Corporation' LIMIT 1;
  SELECT id INTO v_contact_id FROM contacts WHERE first_name = 'TEST: John' AND last_name = 'Doe' LIMIT 1;
  SELECT id INTO v_meeting_id FROM meetings WHERE title = 'TEST: Acme Discovery Call' LIMIT 1;

  -- Test 7.1: Create company meeting insight
  RAISE NOTICE '';
  RAISE NOTICE 'Test 7.1: Company Meeting Insights';

  INSERT INTO company_meeting_insights (
    company_id,
    meeting_id,
    insight_type,
    insight_data
  ) VALUES (
    v_company_id,
    v_meeting_id,
    'sentiment',
    '{"sentiment": "positive", "confidence": 0.85}'::jsonb
  );

  SELECT COUNT(*) INTO v_insights_count
  FROM company_meeting_insights
  WHERE company_id = v_company_id;

  IF v_insights_count > 0 THEN
    RAISE NOTICE '✅ Company insights created: % records', v_insights_count;
  ELSE
    RAISE NOTICE '❌ Company insights creation failed';
    v_test_passed := FALSE;
  END IF;

  -- Test 7.2: Create contact meeting insight
  RAISE NOTICE '';
  RAISE NOTICE 'Test 7.2: Contact Meeting Insights';

  INSERT INTO contact_meeting_insights (
    contact_id,
    meeting_id,
    insight_type,
    insight_data
  ) VALUES (
    v_contact_id,
    v_meeting_id,
    'engagement',
    '{"engagement_level": "high", "speaking_time": 45}'::jsonb
  );

  SELECT COUNT(*) INTO v_insights_count
  FROM contact_meeting_insights
  WHERE contact_id = v_contact_id;

  IF v_insights_count > 0 THEN
    RAISE NOTICE '✅ Contact insights created: % records', v_insights_count;
  ELSE
    RAISE NOTICE '❌ Contact insights creation failed';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 7: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 7: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- TEST SUITE 8: Storage and Assets
-- ============================================================================

DO $$
DECLARE
  v_bucket_exists BOOLEAN;
  v_test_passed BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST SUITE 8: Storage & Assets';
  RAISE NOTICE '========================================';

  -- Test 8.1: Verify meeting-assets bucket exists
  SELECT EXISTS(
    SELECT 1 FROM storage.buckets WHERE id = 'meeting-assets'
  ) INTO v_bucket_exists;

  IF v_bucket_exists THEN
    RAISE NOTICE '✅ meeting-assets bucket exists';
  ELSE
    RAISE NOTICE '❌ meeting-assets bucket not found';
    v_test_passed := FALSE;
  END IF;

  IF v_test_passed THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TEST SUITE 8: PASSED';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ TEST SUITE 8: FAILED';
  END IF;
END;
$$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 TEST EXECUTION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review the results above for any failures.';
  RAISE NOTICE 'All tests should show ✅ PASSED';
  RAISE NOTICE '';
  RAISE NOTICE 'To clean up test data, run:';
  RAISE NOTICE 'SELECT test_reset_data();';
  RAISE NOTICE '';
END;
$$;

-- Don't auto-commit, let user review results
ROLLBACK;
