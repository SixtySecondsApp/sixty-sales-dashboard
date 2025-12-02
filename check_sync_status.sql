-- Check recent cron job activity
SELECT 
  job_name,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 20;

-- Check most recent meetings
SELECT 
  id,
  title,
  meeting_start,
  created_at,
  transcript_text IS NOT NULL as has_transcript,
  sentiment_score IS NOT NULL as has_sentiment,
  talk_time_rep_pct IS NOT NULL as has_talk_time,
  transcript_fetch_attempts
FROM meetings
ORDER BY meeting_start DESC
LIMIT 10;

-- Check fathom sync state
SELECT 
  user_id,
  sync_status,
  last_sync_started_at,
  last_sync_completed_at,
  meetings_synced,
  total_meetings_found,
  last_sync_error
FROM fathom_sync_state
ORDER BY last_sync_completed_at DESC NULLS LAST;

-- Check if pg_cron jobs are configured
SELECT * FROM cron.job WHERE jobname LIKE '%fathom%';
