# Fetch Missing Transcripts - Step by Step Guide

## Quick Solution

Follow these steps to fetch transcripts for the three meetings:

### Step 1: Enqueue Retry Jobs and Set to Retry Immediately

Run this SQL in Supabase SQL Editor:

```sql
-- File: scripts/fetch-all-missing-transcripts.sql
```

This will:
1. Create retry jobs for all three meetings
2. Set `next_retry_at = NOW()` so they're ready immediately
3. Show you the status

### Step 2: Trigger Retry Processor

**Option A: Use the script (recommended)**
```bash
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
./scripts/fetch-transcripts-now.sh
```

**Option B: Use curl directly**
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-transcript-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"batch_size": 50}'
```

**Option C: Wait for cron job**
- The cron job runs every 5 minutes
- Jobs will be processed automatically

### Step 3: Check Results

Run this SQL to see if transcripts were fetched:

```sql
SELECT 
  id,
  title,
  transcript_text IS NOT NULL as has_transcript,
  LENGTH(transcript_text) as transcript_length,
  transcript_fetch_attempts,
  last_transcript_fetch_at
FROM meetings
WHERE id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
);
```

### Step 4: Check Retry Job Status

```sql
SELECT 
  rtj.id,
  m.title,
  rtj.status,
  rtj.attempt_count,
  rtj.last_error,
  rtj.completed_at
FROM fathom_transcript_retry_jobs rtj
JOIN meetings m ON m.id = rtj.meeting_id
WHERE rtj.meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
)
ORDER BY rtj.updated_at DESC;
```

## Expected Results

### For Real Meeting (103141010 - Viewpoint/SixtySeconds)
- **If transcript available in Fathom**: Should be fetched successfully
- **If transcript not available**: Will retry up to 5 times, then mark as failed
- Check `last_error` field for specific error messages

### For Test Meetings (test123, test-final-001)
- **Likely outcome**: Will fail after attempts (expected for test data)
- **If they have transcripts**: Will be fetched successfully

## Troubleshooting

### If Transcripts Still Not Fetched

1. **Check retry job errors**:
```sql
SELECT last_error, attempt_count, status
FROM fathom_transcript_retry_jobs
WHERE meeting_id = '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID;
```

2. **Check Edge Function logs**:
   - Go to Supabase Dashboard → Functions → `fathom-transcript-retry` → Logs
   - Look for error messages

3. **Verify Fathom recording exists**:
   - Log into Fathom dashboard
   - Search for recording ID `103141010`
   - Verify transcript is available there

4. **Test Fathom API directly**:
   - Get access token from `fathom_integrations` table
   - Test: `curl -X GET 'https://api.fathom.ai/external/v1/recordings/103141010/transcript' -H 'Authorization: Bearer TOKEN'`

## All-in-One SQL Script

If you want to do everything in one go, run:

```sql
-- Enqueue jobs
SELECT enqueue_transcript_retry('e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID, 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID, 'test123', 1);
SELECT enqueue_transcript_retry('476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID, 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID, '103141010', 2);
SELECT enqueue_transcript_retry('05891abb-319f-4117-bdca-d26f7db8a35c'::UUID, 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID, 'test-final-001', 5);

-- Set to retry immediately
UPDATE fathom_transcript_retry_jobs
SET next_retry_at = NOW(), updated_at = NOW()
WHERE meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
) AND status = 'pending';

-- Verify ready
SELECT COUNT(*) as ready_jobs FROM fathom_transcript_retry_jobs
WHERE status = 'pending' AND next_retry_at <= NOW()
AND meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
);
```

Then trigger the Edge Function (see Step 2 above).

