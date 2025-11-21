-- Test Script: Enqueue Transcript Retry Job
-- This script finds a meeting without a transcript and enqueues a retry job

-- Step 1: Find a meeting without a transcript that needs a retry job
-- This will show you meetings that could benefit from retry jobs
SELECT 
  m.id as meeting_id,
  m.title,
  m.fathom_recording_id,
  m.owner_user_id as user_id,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  CASE 
    WHEN rtj.id IS NOT NULL THEN 'Already has retry job'
    WHEN m.transcript_fetch_attempts IS NULL OR m.transcript_fetch_attempts < 5 THEN 'Needs retry job'
    ELSE 'Max attempts reached'
  END as status
FROM meetings m
LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id 
  AND rtj.status IN ('pending', 'processing')
WHERE m.transcript_text IS NULL
  AND m.fathom_recording_id IS NOT NULL
  AND m.owner_user_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 5;

-- Step 2: Copy one of the meeting_id values from above and use it below
-- Replace the UUIDs with actual values from Step 1

-- Example (replace with actual UUIDs from Step 1):
-- SELECT enqueue_transcript_retry(
--   '00000000-0000-0000-0000-000000000000'::UUID,  -- meeting_id from Step 1
--   '00000000-0000-0000-0000-000000000000'::UUID,  -- user_id (owner_user_id) from Step 1
--   'recording-id-here',                            -- fathom_recording_id from Step 1
--   1                                                -- initial attempt count
-- );

-- Step 3: Verify the retry job was created
-- Replace the UUID with the meeting_id you used in Step 2
-- SELECT * FROM v_pending_transcript_retries
-- WHERE meeting_id = '00000000-0000-0000-0000-000000000000'::UUID;

-- Alternative: Enqueue retry jobs for ALL meetings missing transcripts
-- (Use with caution - this will create many retry jobs)
-- INSERT INTO fathom_transcript_retry_jobs (
--   meeting_id,
--   user_id,
--   recording_id,
--   attempt_count,
--   max_attempts,
--   next_retry_at,
--   status
-- )
-- SELECT 
--   m.id,
--   m.owner_user_id,
--   m.fathom_recording_id,
--   COALESCE(m.transcript_fetch_attempts, 0) + 1,
--   5,
--   NOW() + INTERVAL '5 minutes',
--   'pending'
-- FROM meetings m
-- WHERE m.transcript_text IS NULL
--   AND m.fathom_recording_id IS NOT NULL
--   AND m.owner_user_id IS NOT NULL
--   AND NOT EXISTS (
--     SELECT 1 FROM fathom_transcript_retry_jobs rtj
--     WHERE rtj.meeting_id = m.id
--       AND rtj.status IN ('pending', 'processing')
--   )
-- LIMIT 10;  -- Limit to 10 meetings for testing

