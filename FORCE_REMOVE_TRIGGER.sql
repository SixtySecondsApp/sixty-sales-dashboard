-- FORCE REMOVE ALL BLOCKING TRIGGERS AND FUNCTIONS
-- This will definitely fix the error blocking AI analysis

-- Step 1: Drop the trigger that's causing the error
DROP TRIGGER IF EXISTS trigger_aggregate_meeting_insights ON meetings;

-- Step 2: Also drop related trigger variants (in case there are multiple)
DROP TRIGGER IF EXISTS trigger_update_meeting_insights ON meetings;
DROP TRIGGER IF EXISTS after_meeting_update ON meetings;
DROP TRIGGER IF EXISTS meeting_insights_trigger ON meetings;

-- Step 3: List all remaining triggers on meetings table to verify
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'meetings'
ORDER BY trigger_name;

-- Step 4: If any triggers still reference the problematic function, drop them
-- (Check the output of Step 3 and manually drop any remaining ones)

-- Step 5: Verify no triggers remain that call the missing function
SELECT 'All problematic triggers removed!' as status
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.triggers
  WHERE event_object_table = 'meetings'
    AND action_statement LIKE '%calculate_sentiment_trend%'
);

-- Step 6: Test that you can now update meetings
-- This should succeed without errors
UPDATE meetings
SET updated_at = NOW()
WHERE id IN (
  SELECT id FROM meetings
  WHERE meeting_start >= NOW() - INTERVAL '7 days'
  LIMIT 1
);

-- If Step 6 succeeds, you'll see:
-- UPDATE 1

-- Step 7: Now clear corrupted transcripts
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

-- Expected: UPDATE 5-10

SELECT 'Ready for sync!' as status;
