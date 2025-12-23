-- Migration: Queue existing meetings without transcripts for reprocessing
-- Purpose: Creates retry jobs for meetings that are missing transcripts/summaries
-- This is a one-time migration to catch up on meetings that weren't processed

-- First, ensure meetings have correct status based on current data
UPDATE meetings SET
  transcript_status = CASE
    WHEN transcript_text IS NOT NULL AND transcript_text != '' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END,
  summary_status = CASE
    WHEN summary IS NOT NULL AND summary != '' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END,
  thumbnail_status = CASE
    WHEN thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE '%dummyimage.com%' THEN 'complete'::meeting_processing_status
    ELSE 'pending'::meeting_processing_status
  END
WHERE fathom_recording_id IS NOT NULL;

-- Reset failed jobs to pending so they can be retried
UPDATE fathom_transcript_retry_jobs
SET
  status = 'pending',
  next_retry_at = NOW(),
  updated_at = NOW()
WHERE status = 'failed';

-- Insert retry jobs for meetings that:
-- 1. Have a Fathom recording ID (came from Fathom)
-- 2. Don't have a transcript yet
-- 3. Don't already have a retry job (pending, processing, or completed)
INSERT INTO fathom_transcript_retry_jobs (
  meeting_id,
  user_id,
  recording_id,
  status,
  attempt_count,
  max_attempts,
  next_retry_at,
  created_at,
  updated_at
)
SELECT
  m.id as meeting_id,
  m.owner_user_id as user_id,
  m.fathom_recording_id as recording_id,
  'pending' as status,
  0 as attempt_count,
  12 as max_attempts,
  NOW() as next_retry_at,
  NOW() as created_at,
  NOW() as updated_at
FROM meetings m
WHERE m.fathom_recording_id IS NOT NULL
  AND (m.transcript_text IS NULL OR m.transcript_text = '')
  AND m.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fathom_transcript_retry_jobs j
    WHERE j.meeting_id = m.id
  );

-- Log the count
DO $$
DECLARE
  pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM fathom_transcript_retry_jobs
  WHERE status = 'pending';

  RAISE NOTICE '✅ Queued % meetings for transcript reprocessing', pending_count;
END $$;
