# Fathom Webhook Diagnostic Summary

**Date**: 2025-11-03
**Issue**: New meetings not appearing automatically after Fathom recording
**Status**: ✅ Webhook infrastructure ready, configuration steps provided

---

## 🔍 Investigation Results

### ✅ What's Working

1. **Webhook Endpoint Deployed**
   - URL: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook`
   - Status: Deployed and operational
   - Location: `/supabase/functions/fathom-webhook/index.ts`

2. **Sync Function Ready**
   - Handles webhook payloads correctly
   - Processes meetings, contacts, and action items
   - Auto-fetches transcripts and runs AI analysis

3. **Enhanced Logging Added**
   - Detailed request tracking with unique IDs
   - Full payload analysis and debugging info
   - User lookup tracing and error reporting
   - Performance metrics (sync duration, timing)

### ⚠️ What Needs Configuration

1. **Fathom Webhook Setup**
   - **ACTION REQUIRED**: Add webhook URL in Fathom settings
   - Location: Fathom Settings → Integrations/Webhooks
   - Event: "Recording Ready" (or equivalent)

2. **Verification Needed**
   - Confirm your Fathom integration is active
   - Run the SQL checks to verify database state

---

## 📋 Step-by-Step Configuration

### Step 1: Verify Integration Status

Run this SQL query in [Supabase SQL Editor](https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor):

```sql
SELECT
    user_id,
    fathom_user_email,
    is_active,
    token_expires_at,
    CASE
        WHEN token_expires_at < NOW() THEN '❌ EXPIRED'
        WHEN token_expires_at < NOW() + INTERVAL '1 day' THEN '⚠️  EXPIRES SOON'
        ELSE '✅ VALID'
    END as token_status
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';
```

**Expected Result**: 1 row with `is_active = true` and token status `✅ VALID`

**If No Results**:
- Go to Settings → Integrations in your CRM
- Reconnect Fathom integration

### Step 2: Configure Webhook in Fathom

1. **Open Fathom Settings**
   - Go to [Fathom Settings](https://app.fathom.video/settings)
   - Find Integrations, API, or Webhooks section

2. **Add New Webhook**
   - Click "Add Webhook" or similar button
   - Paste webhook URL:
     ```
     https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
     ```

3. **Select Events**
   - ✅ Recording Ready
   - ✅ Transcript Ready (if available as separate event)
   - ✅ Action Items Ready (if available)

4. **Save and Verify**
   - Fathom may send a test webhook
   - Status should show "✅ Verified" or "Active"

### Step 3: Test with Real Meeting

1. **Record a Test Meeting**
   - Schedule a quick 2-minute meeting
   - Record with Fathom
   - Wait for processing (~2-5 minutes)

2. **Check Logs**
   - Go to [Edge Function Logs](https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions)
   - Filter by `fathom-webhook`
   - Look for log entry matching your meeting time

3. **Verify in CRM**
   - Check Meetings page
   - New meeting should appear with:
     - ✅ Meeting details
     - ✅ Participants/contacts
     - ✅ Summary (when available)
     - ✅ Action items (when available)

---

## 🔧 Tools Provided

### 1. Configuration Checker Script

```bash
./check-fathom-webhook-config.sh
```

**What it does**:
- Verifies webhook endpoint accessibility
- Tests payload processing
- Provides setup instructions
- Gives next steps

### 2. Integration Checker SQL

```bash
psql -f check-fathom-integration.sql
```

Or run in Supabase SQL Editor to check:
- Integration status
- Token expiry
- Recent sync history
- Today's meetings

### 3. Setup Guide

See `FATHOM_WEBHOOK_SETUP.md` for:
- Detailed configuration steps
- Webhook payload structure
- Troubleshooting guide
- Security notes

---

## 📊 Enhanced Logging Format

When a webhook is received, you'll see logs like this:

```
╔════════════════════════════════════════════════════════════════
║ 📡 FATHOM WEBHOOK RECEIVED
║ Request ID: abc12345
║ Timestamp: 2025-11-03T10:30:00Z
║ Method: POST
║ User-Agent: Fathom-Webhook/1.0
╚════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────
│ 📦 WEBHOOK PAYLOAD ANALYSIS (Request abc12345)
├─────────────────────────────────────────────────────────────────
│ Recording ID: 12345
│ Title: Your Meeting Title
│ Recorded By: andrew@sixty.xyz
│ Team: Sales
│ Recording Start: 2025-11-03T10:00:00Z
│ Recording End: 2025-11-03T11:00:00Z
├─────────────────────────────────────────────────────────────────
│ Data Availability:
│ ✓ Transcript: YES
│ ✓ Summary: YES
│ ✓ Action Items: YES (3)
│ ✓ Calendar Invitees: 2 participants
└─────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────
│ 👤 USER LOOKUP (Request abc12345)
│ Searching for: andrew@sixty.xyz
├─────────────────────────────────────────────────────────────────
│ Step 1: Checking fathom_integrations table...
│ ✅ Found active integration!
│    Email: andrew@sixty.xyz
│    User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
└─────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────
│ 🔄 CALLING SYNC FUNCTION (Request abc12345)
│ URL: .../functions/v1/fathom-sync
│ User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
│ Recording ID: 12345
└─────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────
│ ✅ SYNC COMPLETED (Request abc12345)
│ Duration: 2341ms
│ Meetings Synced: 1
│ Errors: 0
└─────────────────────────────────────────────────────────────────

╔════════════════════════════════════════════════════════════════
║ ✅ WEBHOOK PROCESSING COMPLETE
║ Request ID: abc12345
║ Recording ID: 12345
║ User ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
║ Total Duration: 2456ms
╚════════════════════════════════════════════════════════════════
```

---

## 🐛 Troubleshooting

### Issue: No Webhook Logs Appearing

**Check**:
1. Webhook is configured in Fathom
2. Correct URL (no typos)
3. Events are selected
4. Webhook is enabled/active

**Solution**:
- Double-check Fathom webhook configuration
- Contact Fathom support to verify webhook functionality on your plan

### Issue: Webhook Fires But No Meeting Synced

**Symptoms in Logs**:
```
❌ Could not determine user_id for webhook
Reason: No active Fathom integration found for andrew@sixty.xyz
```

**Solution**:
1. Run integration status SQL query
2. If no integration found, reconnect in Settings → Integrations
3. If token expired, reconnect integration

### Issue: Partial Data Missing

**Symptoms**: Meeting appears but no transcript/summary/action items

**Explanation**: Fathom processes different data at different times:
1. Recording ready (2-5 min) → Basic meeting info
2. Transcript ready (5-10 min) → Transcript available
3. AI processing (10-15 min) → Summary and action items

**Solution**: Wait for full processing, then:
- Manual sync via Settings → Integrations → Sync Now
- Or webhook will fire again when additional data is ready

---

## ✅ Success Indicators

You'll know it's working when:

- [ ] SQL query shows active integration
- [ ] Webhook configured in Fathom with ✅ status
- [ ] Test meeting recorded
- [ ] Logs show webhook received with Request ID
- [ ] Logs show "✅ SYNC COMPLETED"
- [ ] Meeting appears in CRM Meetings page
- [ ] Contacts created/linked automatically
- [ ] Action items appear (when available)

---

## 📞 Next Steps

1. **Immediate**: Run integration status SQL query
2. **If Active**: Configure webhook in Fathom settings
3. **Test**: Record a short test meeting
4. **Monitor**: Check logs 5 minutes after recording
5. **Verify**: Confirm meeting appears in CRM

---

## 🔗 Quick Links

- **Webhook Endpoint**: https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
- **Edge Function Logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions
- **SQL Editor**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor
- **Fathom Settings**: https://app.fathom.video/settings

---

## 📝 Files Created/Modified

1. **Enhanced Webhook Function**: `/supabase/functions/fathom-webhook/index.ts`
   - Added comprehensive logging
   - Request tracking with unique IDs
   - Detailed error reporting

2. **Setup Guide**: `/FATHOM_WEBHOOK_SETUP.md`
   - Complete configuration instructions
   - Troubleshooting section
   - Security notes

3. **Configuration Checker**: `/check-fathom-webhook-config.sh`
   - Interactive setup verification
   - Endpoint testing
   - Next steps guidance

4. **Integration Checker**: `/check-fathom-integration.sql`
   - Database status queries
   - Token expiry checks
   - Recent sync history

---

**Status**: Ready for configuration ✅
**Action Required**: Configure webhook in Fathom settings
**Support**: Review `FATHOM_WEBHOOK_SETUP.md` for detailed instructions
