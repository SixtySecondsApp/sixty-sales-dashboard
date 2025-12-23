# Transcript Retry System - Deployment & Test Results

## Deployment Status

### ✅ Edge Function Deployed
- **Function**: `fathom-transcript-retry`
- **Status**: Successfully deployed to project `ewtuefzeogytgmsnkpmb`
- **URL**: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-transcript-retry`
- **Deployment Time**: $(date)

### 📋 Database Migrations
Run the following SQL queries in Supabase SQL Editor to verify:

#### 1. Check Table Exists
```sql
SELECT 
  'Retry Jobs Table' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fathom_transcript_retry_jobs') 
    THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status;
```

#### 2. Check Functions Exist
```sql
SELECT 
  proname as function_name,
  '✓ EXISTS' as status
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
  AND proname IN (
    'enqueue_transcript_retry',
    'complete_transcript_retry_job',
    'get_pending_transcript_retry_jobs',
    'trigger_transcript_retry_processor'
  );
```

#### 3. Check Cron Job Scheduled
```sql
SELECT 
  jobname,
  schedule,
  active,
  '✓ SCHEDULED' as status
FROM cron.job 
WHERE jobname = 'fathom-transcript-retry';
```

#### 4. Check Monitoring Views
```sql
SELECT 
  table_name as view_name,
  '✓ EXISTS' as status
FROM information_schema.views 
WHERE table_name IN (
  'v_failed_transcript_retries',
  'v_pending_transcript_retries',
  'v_transcript_retry_stats'
);
```

## Testing Checklist

### Test 1: Verify System Components
- [ ] Run verification SQL queries above
- [ ] Confirm all components show "✓ EXISTS" or "✓ SCHEDULED"
- [ ] Check Edge Function logs in Supabase Dashboard

### Test 2: Test Retry Job Creation
1. Find a meeting without a transcript:
```sql
SELECT 
  id,
  title,
  fathom_recording_id,
  transcript_text IS NOT NULL as has_transcript
FROM meetings
WHERE transcript_text IS NULL
  AND fathom_recording_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

2. Manually enqueue a retry job:
```sql
SELECT enqueue_transcript_retry(
  'MEETING_ID_HERE'::UUID,
  'USER_ID_HERE'::UUID,
  'RECORDING_ID_HERE',
  1
);
```

3. Verify job was created:
```sql
SELECT * FROM v_pending_transcript_retries
WHERE meeting_id = 'MEETING_ID_HERE'::UUID;
```

Expected: Job with `status = 'pending'`, `attempt_count = 1`, `next_retry_at` ~5 minutes from now

### Test 3: Test Retry Processor
1. Manually trigger the retry processor (requires service role key):
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-transcript-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"batch_size": 10}'
```

2. Check job status after processing:
```sql
SELECT 
  id,
  status,
  attempt_count,
  next_retry_at,
  last_error,
  updated_at
FROM fathom_transcript_retry_jobs
WHERE meeting_id = 'MEETING_ID_HERE'::UUID
ORDER BY updated_at DESC
LIMIT 1;
```

Expected:
- If transcript available: `status = 'completed'`
- If transcript not available: `status = 'pending'`, `attempt_count = 2`, `next_retry_at` updated

### Test 4: Test Webhook Integration
1. Trigger a Fathom webhook for a new meeting
2. Check if retry job was automatically created:
```sql
SELECT * FROM v_pending_transcript_retries
ORDER BY created_at DESC
LIMIT 5;
```

3. Wait 5 minutes and check if retry processor ran (check `updated_at` timestamp)

### Test 5: Monitor Retry Statistics
```sql
SELECT * FROM v_transcript_retry_stats;
```

This shows:
- Pending/processing/completed/failed counts
- Average attempts to complete
- Unique users/meetings with retries

## Expected Behavior

### When Webhook Received
1. `fathom-webhook` receives webhook payload
2. Calls `fathom-sync` to create/update meeting
3. `autoFetchTranscriptAndAnalyze` attempts to fetch transcript
4. If transcript missing → `enqueue_transcript_retry()` called
5. Retry job created with `status = 'pending'`, `next_retry_at = NOW() + 5 minutes`

### When Retry Processor Runs (Every 5 Minutes)
1. `get_pending_transcript_retry_jobs()` fetches jobs where `next_retry_at <= NOW()`
2. For each job:
   - Mark as `processing`
   - Fetch transcript from Fathom API
   - If successful: Update meeting, mark job `completed`
   - If failed: Increment `attempt_count`, update `next_retry_at`, mark `pending`
   - If `attempt_count >= max_attempts`: Mark `failed`

### When Transcript Manually Fetched
1. `fetch-transcript` or `backfill-transcripts` successfully fetches transcript
2. `complete_transcript_retry_job()` called
3. Any pending retry jobs for that meeting are marked `completed`

## Troubleshooting

### Retry Jobs Not Processing
1. Check cron job is active:
```sql
SELECT * FROM cron.job WHERE jobname = 'fathom-transcript-retry';
```

2. Check cron job logs:
```sql
SELECT * FROM cron_job_logs
WHERE job_name LIKE '%transcript%'
ORDER BY created_at DESC
LIMIT 10;
```

3. Check Edge Function logs in Supabase Dashboard

### Jobs Stuck in Processing
If jobs are stuck (likely due to Edge Function crash):
```sql
UPDATE fathom_transcript_retry_jobs
SET 
  status = 'pending',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Verify Edge Function Deployment
Check in Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
- Verify `fathom-transcript-retry` is listed and shows as deployed

## Next Steps

1. ✅ Edge Function deployed
2. ⏳ Run database verification queries
3. ⏳ Test retry job creation
4. ⏳ Monitor retry processor execution
5. ⏳ Verify webhook integration creates retry jobs automatically

## Monitoring

Use these queries regularly to monitor the system:

```sql
-- Current retry statistics
SELECT * FROM v_transcript_retry_stats;

-- Pending jobs ready to retry
SELECT * FROM v_pending_transcript_retries
WHERE retry_status = 'ready'
ORDER BY next_retry_at ASC;

-- Failed jobs needing attention
SELECT * FROM v_failed_transcript_retries
ORDER BY updated_at DESC
LIMIT 20;
```

