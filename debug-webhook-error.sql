-- Debug Webhook 500 Error
-- Run these queries to identify what's failing

-- 1. Check if we have recent webhook attempts in the logs
-- (The Edge Function might be logging errors to a table)
SELECT
  id,
  title,
  meeting_start,
  created_at,
  transcript_text IS NOT NULL as has_transcript,
  transcript_fetch_attempts,
  owner_user_id,
  owner_email
FROM meetings
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check for failed meeting syncs
SELECT
  id,
  fathom_recording_id,
  title,
  owner_email,
  created_at,
  transcript_fetch_attempts
FROM meetings
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND transcript_text IS NULL
ORDER BY created_at DESC;

-- 3. Check active Fathom integrations
SELECT
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  token_expires_at > NOW() as token_valid,
  created_at
FROM fathom_integrations
ORDER BY is_active DESC, token_expires_at DESC;

-- 4. Check for any error logs (if you have a logs table)
SELECT *
FROM cron_job_logs
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- INSTRUCTIONS:
-- 1. Run these queries in Supabase SQL Editor
-- 2. Share the results, especially:
--    - Are any meetings being created?
--    - What's the owner_email for recent meetings?
--    - Are tokens valid?
-- 3. Then go to: Supabase Dashboard > Edge Functions > fathom-webhook > Logs
--    - Look for the error message from the 500 response
--    - It should show the actual error text
