# 🔍 Next Steps - Integration Verification

You just connected Fathom in the CRM, but the webhook still can't find the integration.

## 🎯 Do These 3 Things Now

### 1. Verify Integration in Database (MOST IMPORTANT)

Run this in SQL Editor: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor

```sql
SELECT 
    user_id,
    fathom_user_email,
    is_active,
    created_at
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';
```

**What to expect**:
- ✅ **1 row returned** = Integration exists, webhook should work
- ❌ **0 rows** = Integration didn't save, need to reconnect

### 2. Check Edge Function Logs

Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter: `fathom-webhook`

**Look for**:
```
║ 👤 USER LOOKUP
│ Searching for: andrew@sixty.xyz
│ Step 1: Checking fathom_integrations table...
│ ✅ Found active integration!   <- GOOD!
```

OR

```
│ ❌ No active integration found  <- BAD!
```

### 3. If No Integration Found

**Two possible reasons**:

**A) OAuth flow didn't complete properly**
- Go back to Integrations page
- Click "Disconnect" (if button exists)
- Click "Connect Fathom" again
- Complete OAuth flow
- Check database again

**B) Different email address**
- Check what email you're logged into Fathom with
- Make sure it matches `andrew@sixty.xyz`
- Or update the SQL query to search for the actual email

---

## 🧪 Quick Test

After you verify the integration exists in the database, run this:

```bash
curl -X POST https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook \
  -H "Content-Type: application/json" \
  -d '{"recording_id":"verify-test","title":"Test","recording_start_time":"2025-11-03T10:00:00Z","recording_end_time":"2025-11-03T11:00:00Z","recorded_by":{"email":"andrew@sixty.xyz"}}'
```

**Expected**:
```json
{"success":true,"message":"Webhook processed successfully",...}
```

---

## 📊 Current Status

| Check | Status | Action |
|-------|--------|--------|
| Webhook endpoint | ✅ Working | None |
| JWT disabled | ✅ Done | None |
| Fathom connected in UI | ✅ Done | None |
| Integration in database | ❓ Unknown | **CHECK NOW** |
| Webhook configured in Fathom | ❌ Not yet | Do after DB verified |

---

## 🎯 What's Next

**If integration IS in database**:
1. Configure webhook in Fathom settings
2. Record test meeting
3. Wait 5 minutes
4. Check CRM for automatic sync

**If integration NOT in database**:
1. Reconnect Fathom in Integrations page
2. Check for OAuth errors in browser console
3. Verify callback URL is configured correctly

---

**START HERE**: Run the SQL query above to verify integration exists!
