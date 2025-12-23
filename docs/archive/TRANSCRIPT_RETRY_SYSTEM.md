# Fathom Transcript Retry System

## Overview

The transcript retry system ensures that Fathom meeting transcripts are automatically fetched with a robust 5×5min retry mechanism. When a webhook is received or a sync occurs, if the transcript is not immediately available, a retry job is enqueued and processed every 5 minutes up to 5 times.

## Architecture

### Components

1. **Database Queue** (`fathom_transcript_retry_jobs` table)
   - Stores retry jobs with attempt tracking
   - Partial unique index ensures one pending job per meeting
   - Status: `pending`, `processing`, `completed`, `failed`

2. **Retry Processor** (`fathom-transcript-retry` Edge Function)
   - Runs every 5 minutes via pg_cron
   - Processes pending jobs ready for retry
   - Fetches transcripts and updates meeting records

3. **Producers**
   - `fathom-webhook`: Enqueues retry job after initial sync if transcript missing
   - `fathom-sync`: Enqueues retry job after sync if transcript missing
   - Manual tools (`backfill-transcripts`, `fetch-transcript`) clear jobs on success

### Flow

```
Webhook Received
    ↓
fathom-sync called
    ↓
Meeting created/updated
    ↓
autoFetchTranscriptAndAnalyze called
    ↓
Transcript available? ──No──→ Enqueue retry job
    │                              ↓
   Yes                          Wait 5 minutes
    ↓                              ↓
Store transcript            Retry processor runs
    ↓                              ↓
Clear retry jobs            Fetch transcript
    ↓                              ↓
                            Success? ──No──→ Increment attempt, schedule next retry
                                │                    ↓
                               Yes              Max attempts? ──Yes──→ Mark failed
                                ↓                    │
                            Store transcript         No
                                ↓                    ↓
                            Clear retry jobs    Wait 5 minutes, retry
```

## Monitoring Queries

### Check Failed Retry Jobs

```sql
SELECT * FROM v_failed_transcript_retries
ORDER BY updated_at DESC
LIMIT 20;
```

### Check Pending Retry Jobs

```sql
SELECT * FROM v_pending_transcript_retries
WHERE retry_status = 'ready'
ORDER BY next_retry_at ASC;
```

### Get Retry Statistics

```sql
SELECT * FROM v_transcript_retry_stats;
```

### Check Status for Specific Meeting

```sql
SELECT * FROM get_meeting_retry_status('meeting-id-here'::UUID);
```

### Find Meetings Missing Transcripts

```sql
SELECT 
  m.id,
  m.title,
  m.fathom_recording_id,
  m.transcript_fetch_attempts,
  m.last_transcript_fetch_at,
  CASE 
    WHEN rtj.id IS NOT NULL THEN 'Has retry job'
    WHEN m.transcript_fetch_attempts IS NULL OR m.transcript_fetch_attempts < 5 THEN 'Needs retry job'
    ELSE 'Max attempts reached'
  END as status
FROM meetings m
LEFT JOIN fathom_transcript_retry_jobs rtj ON rtj.meeting_id = m.id 
  AND rtj.status IN ('pending', 'processing')
WHERE m.transcript_text IS NULL
  AND m.fathom_recording_id IS NOT NULL
ORDER BY m.created_at DESC;
```

## Testing Retry Cadence

### Test 1: Verify Retry Job Creation

1. Trigger a webhook for a meeting that doesn't have a transcript yet
2. Check if retry job was created:

```sql
SELECT * FROM fathom_transcript_retry_jobs
WHERE meeting_id = 'your-meeting-id'::UUID
ORDER BY created_at DESC
LIMIT 1;
```

Expected: Job with `status = 'pending'`, `attempt_count = 1`, `next_retry_at = NOW() + 5 minutes`

### Test 2: Verify Retry Processor Runs

1. Wait 5 minutes after job creation
2. Check if job was processed:

```sql
SELECT 
  id,
  status,
  attempt_count,
  next_retry_at,
  last_error,
  updated_at
FROM fathom_transcript_retry_jobs
WHERE meeting_id = 'your-meeting-id'::UUID
ORDER BY updated_at DESC
LIMIT 1;
```

Expected: 
- If transcript available: `status = 'completed'`
- If transcript not available: `status = 'pending'`, `attempt_count = 2`, `next_retry_at` updated

### Test 3: Verify Max Attempts

1. Create a test meeting with a recording ID that will never have a transcript
2. Enqueue retry job
3. Wait for 5 retry cycles (25 minutes total)
4. Check final status:

```sql
SELECT * FROM v_failed_transcript_retries
WHERE meeting_id = 'test-meeting-id'::UUID;
```

Expected: `status = 'failed'`, `attempt_count = 5`, `last_error` contains "Max retry attempts reached"

### Test 4: Verify Job Cleanup

1. Manually fetch transcript for a meeting with pending retry job
2. Check if job was cleared:

```sql
SELECT * FROM fathom_transcript_retry_jobs
WHERE meeting_id = 'your-meeting-id'::UUID;
```

Expected: No rows (job cleared) or `status = 'completed'`

## Manual Operations

### Enqueue Retry Job Manually

```sql
SELECT enqueue_transcript_retry(
  'meeting-id'::UUID,
  'user-id'::UUID,
  'recording-id',
  1  -- initial attempt count
);
```

### Clear Retry Job

```sql
SELECT complete_transcript_retry_job('meeting-id'::UUID);
```

### Reset Failed Job

```sql
UPDATE fathom_transcript_retry_jobs
SET 
  status = 'pending',
  attempt_count = 0,
  next_retry_at = NOW() + INTERVAL '5 minutes',
  last_error = NULL,
  updated_at = NOW()
WHERE meeting_id = 'meeting-id'::UUID
  AND status = 'failed';
```

## Troubleshooting

### Retry Jobs Not Processing

1. Check if cron job is scheduled:
```sql
SELECT * FROM cron.job WHERE jobname = 'fathom-transcript-retry';
```

2. Check cron job logs:
```sql
SELECT * FROM cron_job_logs
WHERE job_name = 'fathom_hourly_sync'
ORDER BY created_at DESC
LIMIT 10;
```

3. Check Edge Function logs in Supabase Dashboard

### Jobs Stuck in Processing

If a job is stuck in `processing` status (likely due to Edge Function crash):

```sql
UPDATE fathom_transcript_retry_jobs
SET 
  status = 'pending',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

### Transcript Available But Job Not Completed

Manually complete the job:

```sql
SELECT complete_transcript_retry_job('meeting-id'::UUID);
```

## Performance Considerations

- Retry processor processes up to 50 jobs per run (configurable via `batch_size`)
- 500ms delay between job processing to avoid rate limiting
- Partial unique index ensures efficient lookups for pending jobs
- Failed jobs are indexed separately for monitoring queries

## Configuration

### Adjust Retry Interval

Edit `supabase/migrations/20250125000002_setup_transcript_retry_cron.sql`:
- Change cron schedule from `*/5 * * * *` to desired interval
- Update `INTERVAL '5 minutes'` in retry processor to match

### Adjust Max Attempts

Edit `supabase/migrations/20250125000001_create_transcript_retry_jobs.sql`:
- Change `max_attempts INTEGER DEFAULT 5` to desired value
- Update `max_attempts` in `enqueue_transcript_retry` function

### Adjust Batch Size

Edit `supabase/functions/fathom-transcript-retry/index.ts`:
- Change default `batch_size` from 50 to desired value

