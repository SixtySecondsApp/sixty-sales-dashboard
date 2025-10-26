-- ============================================================================
-- AUTOMATED TEST SUITE - Fathom Integration
-- Run this entire file in Supabase Dashboard SQL Editor
-- ============================================================================

DO $$
DECLARE
  v_tests_passed INTEGER := 0;
  v_tests_failed INTEGER := 0;
  v_tests_total INTEGER := 0;
  v_test_result TEXT;

  -- Test variables
  v_migration_count INTEGER;
  v_table_count INTEGER;
  v_bucket_exists BOOLEAN;
  v_sync_columns INTEGER;
  v_ai_columns INTEGER;
  v_transcript_col INTEGER;
  v_source_columns INTEGER;
  v_helper_funcs INTEGER;
  v_triggers INTEGER;
  v_meeting_id UUID;
  v_action_item_id UUID;
  v_sync_status TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '🧪 FATHOM INTEGRATION - AUTOMATED TESTS';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 1: Database Migrations
  -- ============================================================================

  RAISE NOTICE '📋 Test 1: Database Migrations';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_migration_count
  FROM supabase_migrations.schema_migrations
  WHERE version LIKE '20251025%';

  v_tests_total := v_tests_total + 1;
  IF v_migration_count = 16 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Migration Count (16 applied)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Migration Count (expected 16, got %)', v_migration_count;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 2: New Tables
  -- ============================================================================

  RAISE NOTICE '📋 Test 2: New Tables Created';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'meeting_contacts',
      'contact_meeting_insights',
      'company_meeting_insights',
      'pipeline_stage_recommendations',
      'task_notifications'
    );

  v_tests_total := v_tests_total + 1;
  IF v_table_count = 5 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: New Tables (5 tables created)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: New Tables (expected 5, got %)', v_table_count;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 3: Storage Bucket
  -- ============================================================================

  RAISE NOTICE '📋 Test 3: Storage Bucket';
  RAISE NOTICE '----------------------------------------';

  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'meeting-assets') INTO v_bucket_exists;

  v_tests_total := v_tests_total + 1;
  IF v_bucket_exists THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Storage Bucket (meeting-assets exists)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Storage Bucket (meeting-assets not found)';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 4: Task Sync Columns
  -- ============================================================================

  RAISE NOTICE '📋 Test 4: Task Sync System Columns';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_sync_columns
  FROM information_schema.columns
  WHERE table_name = 'meeting_action_items'
    AND column_name IN ('task_id', 'sync_status', 'synced_at', 'synced_to_task', 'sync_error');

  v_tests_total := v_tests_total + 1;
  IF v_sync_columns = 5 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Task Sync Columns (5 columns present)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Task Sync Columns (expected 5, got %)', v_sync_columns;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 5: AI Analysis Columns
  -- ============================================================================

  RAISE NOTICE '📋 Test 5: AI Analysis Fields';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_ai_columns
  FROM information_schema.columns
  WHERE table_name = 'meeting_action_items'
    AND column_name IN ('ai_task_type', 'ai_confidence_score', 'ai_reasoning', 'ai_deadline');

  v_tests_total := v_tests_total + 1;
  IF v_ai_columns = 4 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: AI Analysis Columns (4 columns present)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: AI Analysis Columns (expected 4, got %)', v_ai_columns;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 6: Meeting Transcript Column
  -- ============================================================================

  RAISE NOTICE '📋 Test 6: Meeting Transcript Storage';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_transcript_col
  FROM information_schema.columns
  WHERE table_name = 'meetings'
    AND column_name = 'transcript_text';

  v_tests_total := v_tests_total + 1;
  IF v_transcript_col = 1 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Transcript Column (transcript_text exists)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Transcript Column (column not found)';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 7: Source Tracking Columns
  -- ============================================================================

  RAISE NOTICE '📋 Test 7: Source Tracking Fields';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_source_columns
  FROM information_schema.columns
  WHERE (table_name = 'companies' OR table_name = 'contacts' OR table_name = 'meetings')
    AND column_name IN ('source', 'first_seen_at');

  v_tests_total := v_tests_total + 1;
  IF v_source_columns >= 6 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Source Tracking (% columns present)', v_source_columns;
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Source Tracking (expected 6+, got %)', v_source_columns;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 8: Helper Functions
  -- ============================================================================

  RAISE NOTICE '📋 Test 8: Sync Helper Functions';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_helper_funcs
  FROM pg_proc
  WHERE proname IN (
    'sync_action_item_to_task',
    'sync_task_to_action_item',
    'is_internal_assignee',
    'get_user_id_from_email'
  );

  v_tests_total := v_tests_total + 1;
  IF v_helper_funcs = 4 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Helper Functions (4 functions exist)';
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Helper Functions (expected 4, got %)', v_helper_funcs;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 9: Sync Triggers
  -- ============================================================================

  RAISE NOTICE '📋 Test 9: Sync Triggers';
  RAISE NOTICE '----------------------------------------';

  SELECT COUNT(*) INTO v_triggers
  FROM pg_trigger
  WHERE tgname LIKE '%sync%action%item%' OR tgname LIKE '%sync%task%';

  v_tests_total := v_tests_total + 1;
  IF v_triggers >= 3 THEN
    v_tests_passed := v_tests_passed + 1;
    RAISE NOTICE '✅ PASS: Sync Triggers (% triggers configured)', v_triggers;
  ELSE
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: Sync Triggers (expected 3+, got %)', v_triggers;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- TEST 10: Create Test Action Item
  -- ============================================================================

  RAISE NOTICE '📋 Test 10: Action Item Creation & Sync';
  RAISE NOTICE '----------------------------------------';

  -- Get a meeting ID
  SELECT id INTO v_meeting_id
  FROM meetings
  LIMIT 1;

  IF v_meeting_id IS NULL THEN
    v_tests_total := v_tests_total + 1;
    v_tests_failed := v_tests_failed + 1;
    RAISE NOTICE '❌ FAIL: No meetings found in database';
  ELSE
    -- Create test action item
    INSERT INTO meeting_action_items (
      meeting_id,
      title,
      assignee_email,
      priority,
      deadline_at
    ) VALUES (
      v_meeting_id,
      'Automated Test - Send Proposal',
      'external@test.com',
      'high',
      NOW() + INTERVAL '3 days'
    )
    RETURNING id INTO v_action_item_id;

    v_tests_total := v_tests_total + 1;
    IF v_action_item_id IS NOT NULL THEN
      v_tests_passed := v_tests_passed + 1;
      RAISE NOTICE '✅ PASS: Action Item Created (ID: %)', v_action_item_id;

      -- Wait for triggers (in practice, would be async)
      PERFORM pg_sleep(2);

      -- Check sync status
      SELECT sync_status INTO v_sync_status
      FROM meeting_action_items
      WHERE id = v_action_item_id;

      v_tests_total := v_tests_total + 1;
      IF v_sync_status IS NOT NULL THEN
        v_tests_passed := v_tests_passed + 1;
        RAISE NOTICE '✅ PASS: Sync Status Set (status: %)', v_sync_status;
      ELSE
        v_tests_failed := v_tests_failed + 1;
        RAISE NOTICE '❌ FAIL: Sync Status Not Set';
      END IF;

      -- Cleanup
      DELETE FROM meeting_action_items WHERE id = v_action_item_id;
      RAISE NOTICE '   Cleaned up test data';
    ELSE
      v_tests_failed := v_tests_failed + 1;
      RAISE NOTICE '❌ FAIL: Failed to create action item';
    END IF;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- FINAL SUMMARY
  -- ============================================================================

  RAISE NOTICE '==========================================';
  RAISE NOTICE '📊 TEST SUMMARY';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Total Tests: %', v_tests_total;
  RAISE NOTICE 'Passed: %', v_tests_passed;
  RAISE NOTICE 'Failed: %', v_tests_failed;
  RAISE NOTICE '';

  IF v_tests_failed = 0 THEN
    RAISE NOTICE '🎉 ALL TESTS PASSED!';
    RAISE NOTICE '✅ Fathom integration is fully functional';
  ELSE
    RAISE NOTICE '⚠️  SOME TESTS FAILED';
    RAISE NOTICE 'Review the failures above';
    RAISE NOTICE '';
    RAISE NOTICE 'Common issues:';
    RAISE NOTICE '  - Migrations not applied: Run all 16 migrations';
    RAISE NOTICE '  - Functions missing: Re-apply MIGRATION_FIX_tasks_sync.sql';
    RAISE NOTICE '  - Storage bucket: Create via Dashboard';
  END IF;

  RAISE NOTICE '==========================================';
END $$;
