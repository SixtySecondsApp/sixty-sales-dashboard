# Fathom Webhook Setup Guide

## 🎯 Overview

This guide explains how to configure Fathom to send webhooks to your CRM when new meetings are recorded.

## 📡 Webhook Endpoint

Your webhook endpoint is:
```
https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
```

## 🔧 Fathom Configuration Steps

### Step 1: Access Fathom Settings

1. Go to [Fathom Settings](https://app.fathom.video/settings)
2. Navigate to **Integrations** or **Webhooks** section

### Step 2: Create Webhook

1. Click **Add Webhook** or **Create New Webhook**
2. Enter the webhook URL:
   ```
   https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
   ```

### Step 3: Configure Events

Select the following events to trigger webhooks:
- ✅ **Recording Ready** - When a recording is processed and ready
- ✅ **Transcript Ready** - When transcript is available (if separate)
- ✅ **Summary Ready** - When AI summary is generated (if separate)

**Note**: Different Fathom plans may have different webhook events. Choose the event that fires when the recording is fully processed.

### Step 4: Verify Configuration

After saving, Fathom may:
1. Send a test webhook to verify the endpoint
2. Show a "✅ Verified" status if successful

## 🧪 Testing the Webhook

### Test 1: Manual Test with Sample Payload

Run this command to test the webhook with a sample payload:

```bash
curl -X POST https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "test-' "$(date +%s)" '",
    "title": "Test Meeting - Webhook Verification",
    "recording_start_time": "' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '",
    "recording_end_time": "' "$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ)" '",
    "recorded_by": {
      "email": "YOUR_EMAIL_HERE",
      "name": "Your Name",
      "team": "Sales"
    },
    "calendar_invitees": [
      {
        "name": "Test Contact",
        "email": "test@example.com",
        "is_external": true
      }
    ],
    "default_summary": {
      "markdown_formatted": "## Test Summary\nThis is a test webhook."
    }
  }'
```

**Replace `YOUR_EMAIL_HERE` with your actual email address.**

### Test 2: Record a Real Meeting

1. Schedule and record a short test meeting in Fathom
2. Wait for processing to complete (~2-5 minutes)
3. Check if the meeting appears in your CRM

## 📊 Monitoring Webhook Activity

### Check Supabase Logs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs)
2. Select **Edge Functions** → **fathom-webhook**
3. Look for recent webhook requests

### Expected Log Output

When a webhook is received successfully, you should see:

```
╔════════════════════════════════════════════════════════════════
║ 📡 FATHOM WEBHOOK RECEIVED
║ Request ID: abc12345
║ Timestamp: 2025-11-03T...
╚════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────
│ 📦 WEBHOOK PAYLOAD ANALYSIS
│ Recording ID: 12345
│ Title: Your Meeting Title
│ Recorded By: your-email@example.com
│ ...
└─────────────────────────────────────────────────────────────────

✅ WEBHOOK PROCESSING COMPLETE
```

## 🔍 Troubleshooting

### Issue: Webhook Not Firing

**Check:**
1. ✅ Webhook is enabled in Fathom settings
2. ✅ Webhook URL is correct (no typos)
3. ✅ Selected events match when your recordings are ready
4. ✅ Your Fathom plan includes webhook functionality

**Solution:**
- Contact Fathom support to verify webhook availability
- Check Fathom webhook status dashboard (if available)

### Issue: Webhook Fires But Meeting Not Synced

**Check Logs for:**
1. ❌ User lookup failed - Your email may not match `fathom_integrations` table
2. ❌ Sync function failed - Check error details in logs

**Solution:**
```sql
-- Verify your Fathom integration
SELECT user_id, fathom_user_email, is_active
FROM fathom_integrations
WHERE fathom_user_email = 'your-email@example.com';

-- If not found or inactive, reconnect Fathom in Settings → Integrations
```

### Issue: 401 or 403 Errors

**This is expected!** The webhook endpoint uses service role authentication internally. External requests without auth headers will be rejected, but **Fathom's webhooks will work** because:
1. Webhook receives payload
2. Looks up user by email from payload
3. Uses service role key to call sync function

**No action needed** unless webhooks are actually failing to process.

## 📋 Webhook Payload Structure

Fathom sends the following payload structure:

```json
{
  "recording_id": "12345",
  "title": "Meeting Title",
  "meeting_title": "Alternative Title Field",
  "url": "https://fathom.video/xyz",
  "share_url": "https://fathom.video/share/xyz",
  "recording_start_time": "2025-11-03T16:00:00Z",
  "recording_end_time": "2025-11-03T17:00:00Z",
  "recorded_by": {
    "email": "host@example.com",
    "name": "Host Name",
    "team": "Sales"
  },
  "calendar_invitees": [
    {
      "name": "Participant Name",
      "email": "participant@example.com",
      "is_external": true,
      "email_domain": "example.com"
    }
  ],
  "default_summary": {
    "template_name": "general",
    "markdown_formatted": "## Summary\n..."
  },
  "action_items": [
    {
      "description": "Task description",
      "user_generated": false,
      "completed": false,
      "recording_timestamp": "00:10:45",
      "recording_playback_url": "https://..."
    }
  ]
}
```

## 🔐 Security Notes

1. **No Authentication Required**: The webhook endpoint is public but validates the user exists in your system
2. **User Validation**: Only processes webhooks for users with active Fathom integrations
3. **Service Role**: Uses Supabase service role key internally for database access
4. **Data Integrity**: All meeting data is validated before storage

## 📞 Support

If you encounter issues:

1. **Check Logs**: Supabase Dashboard → Logs → Edge Functions → fathom-webhook
2. **Verify Integration**: Settings → Integrations → Fathom (should show "Connected")
3. **Test Manually**: Run the curl command above with your email
4. **Check Fathom**: Verify webhook is enabled in Fathom settings

## ✅ Success Checklist

- [ ] Webhook URL configured in Fathom
- [ ] Events selected (Recording Ready)
- [ ] Test webhook sent successfully
- [ ] User email matches fathom_integrations table
- [ ] Test meeting appears in CRM after recording
- [ ] Logs show successful webhook processing

---

**Last Updated**: 2025-11-03
**Endpoint Version**: v2 (Enhanced Logging)
**Webhook Function**: `/supabase/functions/fathom-webhook/index.ts`
