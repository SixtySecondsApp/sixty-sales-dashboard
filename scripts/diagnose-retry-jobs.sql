-- Diagnostic Query: Check Retry Job Status for Specific Meetings
-- This will show the current state of retry jobs and help diagnose issues

-- Check retry job status for these meetings
SELECT 
  rtj.id as job_id,
  rtj.meeting_id,
  m.title,
  m.fathom_recording_id,
  rtj.recording_id as job_recording_id,
  rtj.status as job_status,
  rtj.attempt_count,
  rtj.max_attempts,
  rtj.next_retry_at,
  rtj.last_error,
  rtj.created_at as job_created_at,
  rtj.updated_at as job_updated_at,
  m.transcript_fetch_attempts as meeting_attempts,
  m.last_transcript_fetch_at,
  CASE 
    WHEN rtj.next_retry_at <= NOW() AND rtj.status = 'pending' THEN 'Ready to retry'
    WHEN rtj.next_retry_at > NOW() AND rtj.status = 'pending' THEN 'Waiting for retry time'
    WHEN rtj.status = 'processing' THEN 'Currently processing'
    WHEN rtj.status = 'completed' THEN 'Completed (transcript fetched)'
    WHEN rtj.status = 'failed' THEN 'Failed (max attempts reached)'
    ELSE 'Unknown status'
  END as retry_status_description,
  EXTRACT(EPOCH FROM (rtj.next_retry_at - NOW())) / 60 as minutes_until_next_retry
FROM meetings m
LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id
WHERE m.id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
ORDER BY m.title;

-- Check if retry jobs exist at all
SELECT 
  COUNT(*) as total_retry_jobs,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
  COUNT(*) FILTER (WHERE status = 'processing') as processing_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs
FROM fathom_transcript_retry_jobs
WHERE meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
);

-- Check if cron job is running
SELECT 
  jobname,
  schedule,
  active,
  last_run_started_at,
  last_run_status,
  last_run_duration_ms
FROM cron.job 
WHERE jobname = 'fathom-transcript-retry';

-- Check recent cron job logs
SELECT 
  job_name,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
WHERE job_name LIKE '%transcript%'
ORDER BY created_at DESC
LIMIT 10;

-- Check for any ready-to-retry jobs across all meetings
SELECT 
  COUNT(*) as ready_jobs_count,
  MIN(next_retry_at) as earliest_retry_time,
  MAX(next_retry_at) as latest_retry_time
FROM fathom_transcript_retry_jobs
WHERE status = 'pending'
  AND next_retry_at <= NOW();

