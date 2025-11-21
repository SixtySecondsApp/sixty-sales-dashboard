-- Quick Test: Transcript Retry System
-- Run these queries in order

-- 1. Find meetings without transcripts
SELECT 
  m.id::text as meeting_id,
  m.owner_user_id::text as user_id,
  m.fathom_recording_id,
  m.title,
  m.transcript_fetch_attempts,
  CASE 
    WHEN rtj.id IS NOT NULL THEN 'Has retry job'
    ELSE 'Needs retry job'
  END as retry_status
FROM meetings m
LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id 
  AND rtj.status IN ('pending', 'processing')
WHERE m.transcript_text IS NULL
  AND m.fathom_recording_id IS NOT NULL
  AND m.owner_user_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 5;

-- 2. Auto-enqueue retry jobs for meetings missing transcripts (EASY METHOD)
-- This will automatically create retry jobs for up to 10 meetings
SELECT * FROM auto_enqueue_missing_transcript_retries(10);

-- 2b. Alternative: Enqueue for a specific user only
-- SELECT * FROM auto_enqueue_missing_transcript_retries(10, 'USER_ID_HERE'::UUID);

-- 3. Verify retry jobs were created
SELECT * FROM v_pending_transcript_retries
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check retry statistics
SELECT * FROM v_transcript_retry_stats;

-- 5. View all pending retry jobs
SELECT * FROM v_pending_transcript_retries
ORDER BY next_retry_at ASC
LIMIT 10;

