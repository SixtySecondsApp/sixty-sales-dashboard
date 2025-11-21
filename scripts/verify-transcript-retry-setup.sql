-- Verification Script for Transcript Retry System
-- Run this to verify all components are set up correctly

-- 1. Check if retry jobs table exists
SELECT 
  'Retry Jobs Table' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fathom_transcript_retry_jobs') 
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status;

-- 2. Check if indexes exist
SELECT 
  'Unique Pending Index' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transcript_retry_jobs_unique_pending')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'Pending Jobs Index' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_transcript_retry_jobs_pending')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status;

-- 3. Check if functions exist
SELECT 
  'enqueue_transcript_retry' as function_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'enqueue_transcript_retry')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'complete_transcript_retry_job' as function_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'complete_transcript_retry_job')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'get_pending_transcript_retry_jobs' as function_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_pending_transcript_retry_jobs')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'trigger_transcript_retry_processor' as function_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'trigger_transcript_retry_processor')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status;

-- 4. Check if cron job is scheduled
SELECT 
  'Cron Job' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fathom-transcript-retry')
    THEN '✓ SCHEDULED'
    ELSE '✗ NOT SCHEDULED'
  END as status;

-- 5. Check if monitoring views exist
SELECT 
  'v_failed_transcript_retries' as view_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_failed_transcript_retries')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'v_pending_transcript_retries' as view_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_pending_transcript_retries')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
UNION ALL
SELECT 
  'v_transcript_retry_stats' as view_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_transcript_retry_stats')
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status;

-- 6. Get current retry statistics
SELECT * FROM v_transcript_retry_stats;

-- 7. Check Edge Function deployment (manual check - shows URL)
SELECT 
  'Edge Function URL' as info,
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-transcript-retry' as value;

