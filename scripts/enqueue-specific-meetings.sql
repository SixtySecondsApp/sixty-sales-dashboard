-- Enqueue Retry Jobs for Specific Meetings
-- These are the meetings identified as needing retry jobs

-- Meeting 1: Workflow Audit Test
SELECT enqueue_transcript_retry(
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test123',
  1
) as job_1_id;

-- Meeting 2: Viewpoint/SixtySeconds (the one from original issue)
SELECT enqueue_transcript_retry(
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  '103141010',
  2  -- Already has 1 attempt, so start at 2
) as job_2_id;

-- Meeting 3: Final Integration Test
SELECT enqueue_transcript_retry(
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID,
  'test-final-001',
  5  -- Already has 4 attempts, so start at 5 (last attempt)
) as job_3_id;

-- Verify all retry jobs were created
SELECT 
  rtj.id as job_id,
  rtj.meeting_id,
  m.title,
  rtj.recording_id,
  rtj.attempt_count,
  rtj.max_attempts,
  rtj.status,
  rtj.next_retry_at,
  EXTRACT(EPOCH FROM (rtj.next_retry_at - NOW())) / 60 as minutes_until_retry
FROM fathom_transcript_retry_jobs rtj
JOIN meetings m ON m.id = rtj.meeting_id
WHERE rtj.meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
ORDER BY rtj.created_at DESC;

