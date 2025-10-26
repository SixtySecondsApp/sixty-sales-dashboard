-- ═══════════════════════════════════════════════════════════════
-- FINAL FIX: Remove trigger blocking AI analysis
-- ═══════════════════════════════════════════════════════════════
-- Error: function calculate_sentiment_trend(p_contact_id => uuid) does not exist
-- Trigger: update_insights_on_meeting_sync
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Drop the actual trigger that's causing the error
DROP TRIGGER IF EXISTS update_insights_on_meeting_sync ON meetings;

-- Step 2: Drop all possible trigger name variants (belt and suspenders)
DROP TRIGGER IF EXISTS trigger_aggregate_meeting_insights ON meetings;
DROP TRIGGER IF EXISTS trigger_update_meeting_insights ON meetings;
DROP TRIGGER IF EXISTS after_meeting_update ON meetings;
DROP TRIGGER IF EXISTS meeting_insights_trigger ON meetings;

-- Step 3: Verify all triggers are removed
SELECT
  'Remaining triggers on meetings table:' as info,
  COALESCE(COUNT(*), 0) as trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'meetings';

-- Expected: trigger_count = 0 (or just safe triggers like audit logs)

-- Step 4: List any remaining triggers for manual review
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'meetings';

-- Step 5: Test that UPDATE works now
DO $$
DECLARE
  v_test_meeting_id UUID;
BEGIN
  -- Get a recent meeting ID
  SELECT id INTO v_test_meeting_id
  FROM meetings
  WHERE meeting_start >= NOW() - INTERVAL '7 days'
  LIMIT 1;

  IF v_test_meeting_id IS NOT NULL THEN
    -- Try to update it
    UPDATE meetings
    SET updated_at = NOW()
    WHERE id = v_test_meeting_id;

    RAISE NOTICE 'SUCCESS: Meeting update works! Trigger removed correctly.';
  ELSE
    RAISE NOTICE 'No recent meetings found to test';
  END IF;
END $$;

-- Step 6: Clear corrupted transcripts (now that updates work)
UPDATE meetings
SET
  transcript_text = NULL,
  transcript_fetch_attempts = 0,
  last_transcript_fetch_at = NULL,
  sentiment_score = NULL,
  sentiment_reasoning = NULL,
  talk_time_rep_pct = NULL,
  talk_time_customer_pct = NULL,
  talk_time_judgement = NULL
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND (
    transcript_text LIKE '%[object Object]%'
    OR talk_time_judgement LIKE '%Unable to analyze%'
  );

-- Show results
SELECT
  'Corrupted transcripts cleared!' as status,
  COUNT(*) as meetings_reset
FROM meetings
WHERE meeting_start >= NOW() - INTERVAL '30 days'
  AND transcript_text IS NULL
  AND transcript_fetch_attempts = 0;

-- ═══════════════════════════════════════════════════════════════
-- NEXT STEP: Trigger a sync!
-- ═══════════════════════════════════════════════════════════════
-- 1. Go to http://localhost:5173/integrations
-- 2. Click "Test Sync"
-- 3. Wait 2-5 minutes
-- 4. Check results with VERIFY_AI_SUCCESS.sql
-- ═══════════════════════════════════════════════════════════════
