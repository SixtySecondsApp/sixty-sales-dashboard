# Fathom Integration - Deployment & Setup Guide

Complete guide to deploying and testing the Fathom integration for the Sixty Sales Dashboard.

## 📋 Prerequisites

- [ ] Supabase project created and accessible
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Logged into Supabase CLI (`supabase login`)
- [ ] Fathom account with API access
- [ ] Fathom OAuth application created (get `client_id` and `client_secret`)

## 🔧 Step 1: Deploy Database Migrations

Run all Fathom-related migrations in order:

```bash
# From your project root
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy migrations (they should auto-run, but verify)
supabase db push
```

### Verify Migrations Ran Successfully

```sql
-- Run in Supabase SQL Editor to check tables exist:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'fathom_integrations',
    'fathom_sync_state',
    'fathom_oauth_states',
    'cron_job_logs',
    'meetings'
  )
ORDER BY table_name;
```

Expected result: All 5 tables should be listed.

## 🚀 Step 2: Deploy Edge Functions

Deploy all 4 Fathom Edge Functions:

```bash
# Deploy OAuth initiation function
supabase functions deploy fathom-oauth-initiate

# Deploy OAuth callback function
supabase functions deploy fathom-oauth-callback

# Deploy main sync function
supabase functions deploy fathom-sync

# Deploy cron sync function
supabase functions deploy fathom-cron-sync
```

### Verify Functions Deployed

Check in Supabase Dashboard:
1. Go to Edge Functions section
2. Verify all 4 functions appear:
   - `fathom-oauth-initiate`
   - `fathom-oauth-callback`
   - `fathom-sync`
   - `fathom-cron-sync`

## 🔐 Step 3: Set Environment Secrets

### Get Your Fathom OAuth Credentials

1. Go to Fathom Developer Portal
2. Create OAuth application
3. Get `Client ID` and `Client Secret`
4. Set redirect URI: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/fathom-oauth-callback`

### Set Secrets in Supabase

```bash
# Set Fathom OAuth Client ID
supabase secrets set VITE_FATHOM_CLIENT_ID=your_fathom_client_id_here

# Set Fathom OAuth Client Secret
supabase secrets set VITE_FATHOM_CLIENT_SECRET=your_fathom_client_secret_here

# Set OAuth Redirect URI (use your actual project ref)
supabase secrets set VITE_FATHOM_REDIRECT_URI=https://YOUR_PROJECT_REF.supabase.co/functions/v1/fathom-oauth-callback
```

### Verify Secrets Are Set

```bash
# List all secrets (values are hidden)
supabase secrets list
```

You should see:
- `VITE_FATHOM_CLIENT_ID`
- `VITE_FATHOM_CLIENT_SECRET`
- `VITE_FATHOM_REDIRECT_URI`

## ⚙️ Step 4: Configure Database for Cron Sync

Run the configuration SQL script:

```bash
# Open Supabase SQL Editor in Dashboard, then run:
cat configure-fathom-cron.sql
```

**IMPORTANT**: Edit lines 11 and 18 before running:

```sql
-- Line 11: Replace with your actual Supabase URL
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Line 18: Replace with your service role key (from Dashboard > Settings > API)
ALTER DATABASE postgres SET app.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

⚠️  **SECURITY WARNING**:
- NEVER commit the service role key to Git
- The key should start with `eyJ...`
- Get it from: Supabase Dashboard → Project Settings → API → `service_role` key

### Verify Configuration

```sql
-- Check settings are configured
SELECT
  current_setting('app.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.supabase_service_role_key', true) IS NULL
    THEN 'NOT SET'
    ELSE 'CONFIGURED'
  END as service_role_key_status;
```

## ✅ Step 5: Test the Integration

### Test 1: OAuth Connection

1. Navigate to `/integrations` in your app
2. Find the Fathom card
3. Click "Connect Fathom Account"
4. Complete OAuth authorization in popup
5. Verify connection shows "Connected" badge

**Expected Outcome**:
- Green "Connected" badge appears
- User email displayed
- Scopes shown (should include `public_api`)

### Test 2: Test Sync (Last 5 Calls) - RECOMMENDED FIRST TEST

1. Click "Test Sync (Last 5)" button
2. Watch sync progress in real-time
3. Verify only 5 meetings import

**Expected Outcome**:
- Sync completes quickly (usually < 10 seconds)
- Maximum of 5 meetings imported
- Sync state shows "Meetings Synced: 5" (or fewer if you have less than 5)
- No errors reported

**Verify in Database**:
```sql
-- Check exactly how many meetings were synced
SELECT COUNT(*) as synced_meetings
FROM meetings
WHERE owner_user_id = auth.uid();

-- Should be <= 5 meetings
```

This is the **safest way to test** before doing a full sync!

### Test 3: Quick Sync (Last 30 Days)

1. Click "Quick Sync" button
2. Watch sync state update in real-time
3. Check if meeting appears in database

**Verify in Database**:
```sql
-- Check sync state
SELECT * FROM fathom_sync_state WHERE user_id = auth.uid();

-- Check meetings were imported
SELECT
  id,
  title,
  fathom_recording_id,
  meeting_start,
  duration_minutes,
  owner_email
FROM meetings
WHERE owner_user_id = auth.uid()
ORDER BY meeting_start DESC
LIMIT 10;
```

**Expected Outcome**:
- Sync state shows `meetings_synced > 0`
- At least one meeting in `meetings` table
- Sync completes without errors

### Test 4: All Time Sync

1. Click "Custom Sync Range" button
2. Select "All Time (Complete history)"
3. Click "Start Sync"
4. Monitor progress (may take several minutes)

**Expected Outcome**:
- All historical Fathom meetings imported
- `total_meetings_found` matches your Fathom account
- All meetings appear in `/meetings` page

### Test 5: Verify Meeting Data Structure

```sql
-- Check a single meeting record
SELECT
  id,
  fathom_recording_id,
  title,
  meeting_start,
  meeting_end,
  duration_minutes,
  owner_email,
  share_url,
  calls_url,
  transcript_doc_url,
  summary,
  sentiment_score,
  talk_time_rep_pct,
  talk_time_customer_pct,
  fathom_user_id,
  last_synced_at,
  sync_status
FROM meetings
WHERE owner_user_id = auth.uid()
LIMIT 1;
```

**Expected Fields**:
- `fathom_recording_id` - Unique Fathom call ID
- `share_url` - Public share link
- `transcript_doc_url` - Transcript URL (if available)
- `summary` - AI-generated summary
- `sentiment_score` - Between -1 and 1
- `talk_time_rep_pct` - Rep talk time percentage

## 🕐 Step 6: Test Hourly Cron Sync

### Manual Trigger Test

```sql
-- Manually trigger cron sync (don't wait for scheduled time)
SELECT trigger_fathom_hourly_sync();

-- Check logs immediately after
SELECT * FROM cron_job_logs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Outcome**:
- Log entry with status `'triggered'` or `'success'`
- No error messages in `error_details`

### Verify Cron Schedule

```sql
-- Check cron job is scheduled
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'fathom-hourly-sync';
```

**Expected Outcome**:
- Job exists with schedule `'0 * * * *'` (every hour at minute 0)
- `active = true`

### Monitor Automatic Executions

```sql
-- Wait for next hour, then check if cron ran
SELECT
  job_name,
  status,
  message,
  created_at
FROM cron_job_logs
WHERE job_name = 'fathom-hourly-sync'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Outcome**:
- New log entry every hour
- Status is `'success'` or `'triggered'`

## 🔍 Troubleshooting

### Issue: OAuth Connection Fails

**Symptoms**: Popup shows error or doesn't redirect back

**Solutions**:
1. Check redirect URI matches exactly in Fathom OAuth app settings
2. Verify `VITE_FATHOM_REDIRECT_URI` secret is set correctly
3. Check browser console for errors
4. Verify Edge Functions are deployed

### Issue: Sync Returns 0 Meetings

**Symptoms**: Sync completes but no meetings imported

**Solutions**:
1. Check Fathom account actually has recorded calls
2. Verify date range covers period with calls
3. Check token hasn't expired (see `token_expires_at`)
4. Look at `fathom_sync_state.last_sync_error` for details

```sql
SELECT
  sync_status,
  last_sync_error,
  meetings_synced,
  total_meetings_found
FROM fathom_sync_state
WHERE user_id = auth.uid();
```

### Issue: Cron Sync Not Running

**Symptoms**: No new log entries in `cron_job_logs`

**Solutions**:
1. Verify database settings configured (Step 4)
2. Check cron job is active:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'fathom-hourly-sync';
   ```
3. Manually trigger to test:
   ```sql
   SELECT trigger_fathom_hourly_sync();
   ```
4. Check `cron_job_logs` for error messages

### Issue: API Rate Limiting

**Symptoms**: Sync errors mentioning "429" or "rate limit"

**Solutions**:
1. Use incremental sync instead of all-time
2. Reduce sync frequency
3. Contact Fathom about API rate limits
4. Implement backoff strategy in sync function

### Issue: Meetings Not Showing in UI

**Symptoms**: Database has meetings but UI doesn't display them

**Solutions**:
1. Check RLS policies allow user to see their meetings
2. Verify `owner_user_id` matches `auth.uid()`
3. Check frontend query in `/src/pages/Meetings.tsx`
4. Look for console errors in browser

```sql
-- Verify user can see their meetings
SELECT COUNT(*) FROM meetings WHERE owner_user_id = auth.uid();
```

## 📊 Monitoring & Maintenance

### Check Integration Health

```sql
-- Daily health check query
SELECT
  fi.fathom_user_email,
  fi.is_active,
  fi.token_expires_at,
  fs.sync_status,
  fs.meetings_synced,
  fs.last_sync_completed_at,
  fs.last_sync_error,
  CASE
    WHEN fi.token_expires_at < NOW() + INTERVAL '7 days' THEN 'EXPIRING SOON'
    WHEN fs.sync_status = 'error' THEN 'SYNC ERROR'
    WHEN fs.last_sync_completed_at < NOW() - INTERVAL '2 hours' THEN 'STALE'
    ELSE 'HEALTHY'
  END as health_status
FROM fathom_integrations fi
LEFT JOIN fathom_sync_state fs ON fs.integration_id = fi.id
WHERE fi.is_active = true;
```

### View Sync Performance

```sql
-- Check average sync times and success rate
SELECT
  job_name,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_runs,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate_pct
FROM cron_job_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY job_name;
```

### Clean Up Old Data

```sql
-- The cleanup cron should run daily, but you can manually clean:
SELECT cleanup_old_cron_logs(); -- Removes logs older than 30 days

-- Check OAuth state cleanup
SELECT cleanup_expired_fathom_oauth_states();
```

## 🎉 Success Checklist

- [ ] All 4 Edge Functions deployed successfully
- [ ] Environment secrets configured (3 secrets)
- [ ] Database cron settings configured
- [ ] OAuth connection works (can connect Fathom account)
- [ ] Quick sync imports at least 1 meeting
- [ ] All-time sync imports all historical meetings
- [ ] Meetings display correctly in UI at `/meetings`
- [ ] Manual cron trigger works
- [ ] Automatic hourly sync runs (check after 1 hour)
- [ ] No errors in `cron_job_logs`

## 🔗 Additional Resources

- **Fathom API Docs**: https://docs.fathom.video/api
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **pg_cron Documentation**: https://github.com/citusdata/pg_cron

## 📝 Notes

- Fathom OAuth tokens typically expire after 1 hour
- Refresh token flow not yet implemented (future enhancement)
- Cron sync runs incrementally (last 24 hours) to minimize API calls
- All-time sync may take 5-10 minutes for accounts with 100+ meetings
- Meeting attendees and action items are automatically created
- Contacts are auto-created from external meeting participants
