-- Force Generate Next-Action Suggestions for All Meetings with Transcripts
-- This script will manually trigger suggestion generation for ALL meetings that have transcripts

-- Step 1: Show meetings that will be processed
\echo '========================================='
\echo 'MEETINGS WITH TRANSCRIPTS (WILL PROCESS)'
\echo '========================================='
\echo ''

SELECT
  id,
  title,
  fathom_recording_id,
  LENGTH(transcript_text) as transcript_chars,
  created_at
FROM meetings
WHERE transcript_text IS NOT NULL
ORDER BY created_at DESC;

\echo ''
\echo '========================================='
\echo 'FORCING GENERATION FOR ALL MEETINGS...'
\echo '========================================='
\echo ''

-- Step 2: Force generation for each meeting with transcript
-- Note: This will call the Edge Function for each meeting
DO $$
DECLARE
  meeting_record RECORD;
  result BOOLEAN;
  success_count INT := 0;
  error_count INT := 0;
BEGIN
  FOR meeting_record IN
    SELECT id, title, fathom_recording_id
    FROM meetings
    WHERE transcript_text IS NOT NULL
    ORDER BY created_at DESC
  LOOP
    RAISE NOTICE 'Processing: % (ID: %)', meeting_record.title, meeting_record.id;

    BEGIN
      -- Call the regenerate function
      SELECT regenerate_next_actions_for_activity(
        meeting_record.id,
        'meeting'
      ) INTO result;

      IF result THEN
        success_count := success_count + 1;
        RAISE NOTICE '✅ Success: %', meeting_record.title;
      ELSE
        error_count := error_count + 1;
        RAISE NOTICE '❌ Failed: % (function returned false)', meeting_record.title;
      END IF;

      -- Add a small delay between calls to avoid overwhelming the Edge Function
      PERFORM pg_sleep(2);

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE NOTICE '❌ Error: % - %', meeting_record.title, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'GENERATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Successfully triggered: %', success_count;
  RAISE NOTICE 'Errors: %', error_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Wait 30-60 seconds, then check results with:';
  RAISE NOTICE 'SELECT COUNT(*) FROM next_action_suggestions WHERE activity_type = ''meeting'';';
END $$;

\echo ''
\echo 'Checking results after processing...'
\echo ''

-- Step 3: Show summary of generated suggestions
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_suggestions,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_suggestions,
  COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_suggestions,
  COUNT(*) as total_suggestions
FROM next_action_suggestions
WHERE activity_type = 'meeting';

\echo ''
\echo 'Recent suggestions generated:'
\echo ''

SELECT
  nas.id,
  nas.title,
  nas.urgency,
  nas.status,
  m.title as meeting_title,
  nas.created_at
FROM next_action_suggestions nas
JOIN meetings m ON m.id = nas.activity_id
WHERE nas.activity_type = 'meeting'
ORDER BY nas.created_at DESC
LIMIT 10;
