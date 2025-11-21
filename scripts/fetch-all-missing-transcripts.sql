-- Fetch All Missing Transcripts - Complete Solution
-- This script will enqueue retry jobs and set them to retry immediately

-- Step 1: Enqueue retry jobs for the three specific meetings
SELECT enqueue_transcript_retry(
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test123',
  1
) as job_1_id;

SELECT enqueue_transcript_retry(
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  '103141010',
  2
) as job_2_id;

SELECT enqueue_transcript_retry(
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test-final-001',
  5
) as job_3_id;

-- Step 2: Set all retry jobs to retry immediately (bypass 5-minute wait)
UPDATE fathom_transcript_retry_jobs
SET 
  next_retry_at = NOW(),
  updated_at = NOW()
WHERE meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
AND status = 'pending';

-- Step 3: Verify jobs are ready
SELECT 
  rtj.id as job_id,
  m.title,
  m.fathom_recording_id,
  rtj.recording_id as job_recording_id,
  rtj.status,
  rtj.attempt_count,
  rtj.max_attempts,
  rtj.next_retry_at,
  CASE 
    WHEN rtj.next_retry_at <= NOW() THEN '✅ Ready to retry NOW'
    ELSE '⏳ Waiting'
  END as ready_status
FROM fathom_transcript_retry_jobs rtj
JOIN meetings m ON m.id = rtj.meeting_id
WHERE rtj.meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
ORDER BY rtj.next_retry_at ASC;

-- Step 4: Show count of ready jobs
SELECT 
  COUNT(*) as ready_jobs_count,
  'Run the retry processor Edge Function now' as next_step
FROM fathom_transcript_retry_jobs
WHERE status = 'pending'
  AND next_retry_at <= NOW()
  AND meeting_id IN (
    'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
    '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
    '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
  );

