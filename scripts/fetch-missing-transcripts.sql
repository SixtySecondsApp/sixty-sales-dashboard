-- Fetch Missing Transcripts - Comprehensive Script
-- This script will enqueue retry jobs and provide status

-- Step 1: Enqueue retry jobs for all three meetings
SELECT enqueue_transcript_retry(
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test123',
  1
) as job_1;

SELECT enqueue_transcript_retry(
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  '103141010',
  2
) as job_2;

SELECT enqueue_transcript_retry(
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test-final-001',
  5
) as job_3;

-- Step 2: Verify jobs were created
SELECT 
  rtj.id as job_id,
  m.title,
  rtj.recording_id,
  rtj.status,
  rtj.attempt_count,
  rtj.next_retry_at,
  CASE 
    WHEN rtj.next_retry_at <= NOW() THEN 'Ready now'
    ELSE 'Waiting'
  END as ready_status
FROM fathom_transcript_retry_jobs rtj
JOIN meetings m ON m.id = rtj.meeting_id
WHERE rtj.meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
ORDER BY rtj.next_retry_at ASC;

