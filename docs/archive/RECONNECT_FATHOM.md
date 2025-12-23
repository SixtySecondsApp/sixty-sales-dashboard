# 🔄 Reconnect Fathom Integration

## Current Situation

**Integration Found in Database:**
- ID: `ca77dcdd-bc6a-40c7-9ab5-9058aa8069f8`
- Status: Active but **token expired** (Oct 23 → Nov 3)
- Email: NULL (why webhook failed)
- User: andrew.bryce@sixtyseconds.video

## Why Reconnect Instead of Update?

1. ❌ **Token Expired**: `token_valid = false`
2. ❌ **Email NULL**: Webhook can't find user
3. ✅ **Fresh Connection**: Gets new valid tokens + email

---

## Step-by-Step Reconnection

### Step 1: Disconnect Old Integration

Run this SQL to deactivate the old integration:

```sql
-- Deactivate old integration
UPDATE fathom_integrations
SET is_active = false
WHERE id = 'ca77dcdd-bc6a-40c7-9ab5-9058aa8069f8';
```

Or delete it entirely:
```sql
-- Delete old integration (cleaner)
DELETE FROM fathom_integrations
WHERE id = 'ca77dcdd-bc6a-40c7-9ab5-9058aa8069f8';
```

### Step 2: Connect Fathom in CRM

**Important: Open browser DevTools FIRST**
1. Press F12 to open DevTools
2. Go to Console tab
3. Keep it open during the connection process

**Then connect:**
1. Go to: http://localhost:5173/integrations (or your deployed URL)
2. Find the Fathom card
3. Click "Connect Fathom"
4. Complete OAuth authorization on Fathom
5. Wait for redirect back to CRM
6. Watch console for errors

### Step 3: Monitor Edge Function Logs

**Immediately after connecting**, check logs:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

**Filter by**: `fathom-oauth-callback`

**Look for**:
- ✅ "Integration stored successfully"
- ⚠️ "User info request failed: 404" (this is OK, non-critical)
- ❌ Any actual errors (token exchange failed, etc.)

### Step 4: Verify New Integration

Run this SQL to verify:
```sql
SELECT
    id,
    user_id,
    fathom_user_email,
    is_active,
    created_at,
    token_expires_at > NOW() as token_valid,
    (SELECT email FROM auth.users WHERE id = fathom_integrations.user_id) as user_email
FROM fathom_integrations
WHERE user_id = (
    SELECT id FROM auth.users
    WHERE email = 'andrew.bryce@sixtyseconds.video'
)
ORDER BY created_at DESC
LIMIT 1;
```

**Expected results:**
- `created_at`: Today's date (Nov 3, 2025)
- `is_active`: `true`
- `token_valid`: `true`
- `fathom_user_email`: May still be NULL (that's OK!)

### Step 5: If Email is Still NULL

If the new integration has `fathom_user_email = NULL`, manually update it:

```sql
UPDATE fathom_integrations
SET fathom_user_email = 'andrew.bryce@sixtyseconds.video'
WHERE user_id = (
    SELECT id FROM auth.users
    WHERE email = 'andrew.bryce@sixtyseconds.video'
)
AND created_at > NOW() - INTERVAL '1 hour'
AND fathom_user_email IS NULL;
```

**Note**: Use `andrew.bryce@sixtyseconds.video` NOT `andrew@sixty.xyz` (that's your actual auth email)

### Step 6: Test Webhook

Test the webhook with your correct email:

```bash
curl -X POST https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "test-reconnect-001",
    "title": "Test After Reconnection",
    "recording_start_time": "2025-11-03T10:00:00Z",
    "recording_end_time": "2025-11-03T11:00:00Z",
    "recorded_by": {
      "email": "andrew.bryce@sixtyseconds.video"
    }
  }'
```

**Expected**: `{"success": true, "message": "Webhook processed successfully"}`

---

## Troubleshooting

### If Browser Console Shows Errors

**Common errors:**
- CORS error → Check Supabase CORS settings
- Network error → Check function URL and deployment
- 401/403 → Check Supabase anon key in .env

### If Edge Function Logs Show Errors

**Token exchange failed:**
- Verify Fathom OAuth credentials in .env
- Check redirect URI matches exactly in Fathom settings

**Integration save failed:**
- Check database permissions
- Verify `fathom_integrations` table exists

### If Integration Still Not Created

1. Check edge function logs for exact error
2. Verify OAuth credentials are correct
3. Try connecting from different browser (clear cache)
4. Check Supabase project is not paused

---

## Next Steps After Successful Reconnection

1. ✅ Integration exists with valid token
2. ✅ Email field populated (or manually updated)
3. ✅ Webhook test succeeds
4. → **Configure webhook in Fathom settings**
5. → **Record test meeting and verify automatic sync**

---

## Quick Reference

**Integrations Page**: http://localhost:5173/integrations
**Edge Logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions
**SQL Editor**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor
**Webhook URL**: https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
