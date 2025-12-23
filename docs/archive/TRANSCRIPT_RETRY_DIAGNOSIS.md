# Transcript Retry System - Diagnosis & Action Plan

## Current Status

Three meetings are missing transcripts:
1. **Workflow Audit Test** - Recording ID: `test123` ⚠️ (looks like test data)
2. **Viewpoint/SixtySeconds** - Recording ID: `103141010` ✅ (real recording ID)
3. **Final Integration Test** - Recording ID: `test-final-001` ⚠️ (looks like test data)

## Diagnostic Steps

### Step 1: Check Retry Job Status
Run this SQL to see if retry jobs exist and their status:

```sql
-- File: scripts/diagnose-retry-jobs.sql
```

This will show:
- Whether retry jobs were created
- Current status (pending, processing, completed, failed)
- Next retry time
- Any errors

### Step 2: Check if Retry Jobs Were Created
If retry jobs don't exist, create them:

```sql
-- File: scripts/enqueue-specific-meetings.sql
```

### Step 3: Verify Cron Job is Running
```sql
SELECT 
  jobname,
  schedule,
  active,
  last_run_started_at
FROM cron.job 
WHERE jobname = 'fathom-transcript-retry';
```

Expected: `active = true`, `schedule = '*/5 * * * *'`

### Step 4: Manually Trigger Retry Processor
If cron hasn't run yet, trigger manually:

```bash
# Set your service role key first
export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'

# Run the script
./scripts/manually-trigger-retry.sh
```

Or use curl directly:
```bash
curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-transcript-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"batch_size": 50}'
```

## Potential Issues

### Issue 1: Test Recording IDs
**Problem**: Two meetings have test recording IDs (`test123`, `test-final-001`) that may not exist in Fathom.

**Solution**: 
- These are likely test meetings that won't have transcripts
- You can either:
  - Ignore them (they'll fail after 5 attempts)
  - Delete the retry jobs if not needed
  - Update the recording IDs if they're incorrect

### Issue 2: Recording ID `103141010` - The Real One
**Problem**: This is the meeting from your original issue. If transcript still isn't available:

**Possible causes**:
1. Fathom hasn't finished processing the recording yet
2. Recording ID is incorrect
3. Fathom API is returning errors
4. OAuth token issues

**Diagnosis**:
```sql
-- Check retry job details
SELECT 
  rtj.*,
  rtj.last_error
FROM fathom_transcript_retry_jobs rtj
WHERE rtj.meeting_id = '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID;
```

**Check Edge Function logs** in Supabase Dashboard for specific error messages.

### Issue 3: Retry Jobs Not Processing
**Possible causes**:
1. Cron job not scheduled/active
2. Edge Function errors
3. Service role key not configured

**Fix**:
1. Verify cron job exists and is active (see Step 3 above)
2. Check Edge Function logs
3. Manually trigger retry processor (see Step 4 above)

## Action Plan

### Immediate Actions

1. **Run diagnostic query**:
   ```sql
   -- File: scripts/diagnose-retry-jobs.sql
   ```

2. **If retry jobs don't exist, create them**:
   ```sql
   -- File: scripts/enqueue-specific-meetings.sql
   ```

3. **Manually trigger retry processor**:
   ```bash
   ./scripts/manually-trigger-retry.sh
   ```

4. **Check results**:
   ```sql
   SELECT 
     id,
     title,
     transcript_text IS NOT NULL as has_transcript,
     transcript_fetch_attempts
   FROM meetings
   WHERE id IN (
     'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
     '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
     '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
   );
   ```

### For the Real Meeting (103141010)

1. **Check Fathom directly**:
   - Log into Fathom dashboard
   - Search for recording ID `103141010`
   - Verify transcript is available there
   - Check recording status

2. **Test API directly**:
   ```bash
   # Get access token from fathom_integrations table
   # Then test:
   curl -X GET 'https://api.fathom.ai/external/v1/recordings/103141010/transcript' \
     -H 'Authorization: Bearer YOUR_FATHOM_ACCESS_TOKEN'
   ```

3. **Check retry job errors**:
   ```sql
   SELECT last_error, attempt_count, status
   FROM fathom_transcript_retry_jobs
   WHERE meeting_id = '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID;
   ```

## Expected Outcomes

### For Test Meetings (test123, test-final-001)
- Retry jobs will attempt to fetch transcripts
- After 5 attempts, jobs will be marked as `failed`
- This is expected behavior for test data

### For Real Meeting (103141010)
- If transcript is available in Fathom: Should be fetched within 5 minutes
- If transcript not available: Will retry up to 5 times, then mark as failed
- Check `last_error` field for specific error messages

## Monitoring

After triggering retry processor, monitor:

```sql
-- Check retry job status
SELECT * FROM v_pending_transcript_retries
WHERE meeting_id IN (
  'e0fe3242-d609-47a7-97d6-00925d87d95c'::UUID,
  '476047d5-fa3a-4971-963e-32107e8a4a0e'::UUID,
  '05891abb-319f-4117-bdca-d26f7db8a35c'::UUID
);

-- Check overall statistics
SELECT * FROM v_transcript_retry_stats;
```

## Next Steps

1. ✅ Run diagnostic queries
2. ✅ Create retry jobs if missing
3. ✅ Manually trigger retry processor
4. ⏳ Check results after processing
5. ⏳ Investigate errors if transcripts still missing
6. ⏳ Verify Fathom recording status for real meeting

