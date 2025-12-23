# Fathom Webhook Configuration Guide

## Setup Webhooks in Fathom Dashboard

Webhooks provide real-time sync when recordings complete (much better than waiting for hourly cron).

### Step 1: Get Your Webhook URL

Your webhook endpoint is:
```
https://your-project.supabase.co/functions/v1/fathom-webhook
```

Replace `your-project` with your actual Supabase project reference.

### Step 2: Configure in Fathom

1. **Login to Fathom Dashboard**:
   - Go to https://fathom.video/
   - Navigate to Settings or Team Settings

2. **Find Webhooks/Integrations Section**:
   - Look for "Webhooks", "Integrations", or "API" settings
   - Should be under Team or Account settings

3. **Add New Webhook**:
   - **Event Type**: `recording.ready` (or similar - check Fathom docs)
   - **Endpoint URL**: `https://your-project.supabase.co/functions/v1/fathom-webhook`
   - **Authentication**: None (uses public endpoint with internal auth)

4. **Test the Webhook**:
   - Some platforms allow you to send test events
   - Or record a quick test meeting to verify

### Step 3: Verify Webhook is Working

After recording a meeting, check the logs:

```sql
-- Check recent webhook activity (look for successful syncs)
SELECT
  id,
  title,
  meeting_start,
  created_at,
  transcript_text IS NOT NULL as has_transcript
FROM meetings
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- Check for webhook errors in Edge Function logs
-- Go to Supabase Dashboard > Edge Functions > fathom-webhook > Logs
```

### Expected Webhook Payload

The webhook handler expects this structure:

```json
{
  "recording_id": "abc123",
  "recorded_by": {
    "email": "user@example.com"
  },
  "recording": {
    "recording_share_url": "https://fathom.video/share/abc123",
    "recording_url": "https://fathom.video/calls/12345"
  },
  "meeting": {
    "title": "Client Call",
    "scheduled_start_time": "2025-12-02T10:00:00Z"
  }
}
```

### Troubleshooting

**Webhook Not Receiving Events:**
1. Verify the URL is correct (no typos)
2. Check Fathom's webhook logs for delivery failures
3. Verify the Edge Function is deployed
4. Check Edge Function logs for errors

**Meetings Syncing But Missing Transcripts:**
- Normal! Transcripts take 5-15 minutes to process
- The system will retry fetching transcripts automatically
- Check `transcript_fetch_attempts` column in meetings table

**User Not Found Errors:**
- Webhook tries to match `recorded_by.email` to your users
- Ensure users have connected their Fathom account via OAuth

## Why Webhooks > Cron

- ⚡ **Real-time**: Sync immediately vs waiting up to 1 hour
- 🎯 **Efficient**: Only sync when meetings occur
- 📊 **Reliable**: Fathom's native notification system
- 🔄 **Retry Logic**: Built-in retry with exponential backoff

Keep cron as backup for missed webhooks!
