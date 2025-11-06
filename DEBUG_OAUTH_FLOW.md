# 🔍 DEBUG: OAuth Flow Not Saving Integration

## 📊 Current Status

**Issue**: You clicked "Connect Fathom" in the UI, but no integration record was created in the database.

**What we know**:
1. ✅ Webhook endpoint is working  
2. ✅ OAuth callback code looks correct
3. ❌ Integration record not in database
4. ❓ Unknown: What happened during OAuth flow

---

## 🧪 Debugging Steps

### Step 1: Check Edge Function Logs (CRITICAL)

Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

**Filter by**: `fathom-oauth-callback`

**Look for**:
```
✅ Integration stored successfully: [integration-id]
```

**OR errors like**:
```
❌ Token exchange failed
❌ Failed to store integration
❌ Invalid state parameter
```

### Step 2: Check Browser Console

When you clicked "Connect Fathom":
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors during OAuth flow

**Common errors**:
- `Cross-Origin Request Blocked`
- `Failed to invoke function`
- `Network error`

### Step 3: Verify OAuth Configuration

Check these environment variables are set correctly:

```bash
# In your .env file:
VITE_FATHOM_CLIENT_ID=your-client-id
VITE_FATHOM_CLIENT_SECRET=your-client-secret  
VITE_FATHOM_REDIRECT_URI=http://localhost:5173/auth/fathom/callback
```

**For deployed app**, these should be set in Supabase dashboard:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/settings/functions

### Step 4: Check Fathom OAuth App Settings

In Fathom developer/OAuth settings:

**Redirect URI must exactly match**:
- Local: `http://localhost:5173/auth/fathom/callback`
- Deployed: `https://your-app.com/auth/fathom/callback`

---

## 🎯 Quick Diagnostic Commands

### Check if state was created:
```sql
SELECT * FROM fathom_oauth_states
ORDER BY created_at DESC
LIMIT 5;
```

Expected: Recent rows (< 10 min old)

### Check all integrations (any user):
```sql
SELECT user_id, fathom_user_email, is_active, created_at
FROM fathom_integrations
ORDER BY created_at DESC
LIMIT 5;
```

Expected: See if ANY integrations exist

### Check your user ID:
```sql
SELECT id, email FROM auth.users
WHERE email = 'andrew@sixty.xyz';
```

Get your `user_id` for debugging

---

## 🔧 Common Issues & Fixes

### Issue: "Invalid state parameter"

**Cause**: State token expired or missing from database

**Fix**:
1. Clear old state records
2. Try connecting again

```sql
DELETE FROM fathom_oauth_states
WHERE expires_at < NOW();
```

### Issue: "Token exchange failed"

**Cause**: 
- Wrong client ID/secret
- Wrong redirect URI
- Fathom OAuth app not configured

**Fix**: Verify OAuth credentials in Fathom developer settings

### Issue: "Failed to store integration"

**Cause**: Database permissions or constraint violation

**Fix**: Check Edge Function logs for exact error

### Issue: OAuth completes but no database record

**Cause**: Edge Function crashed after token exchange

**Fix**: Check logs for errors at line 193-213 (database insert)

---

## 🚨 Immediate Action

**Do these 3 things now**:

1. **Check Edge Function logs** (fathom-oauth-callback)
   - Look for ANY logs from your connection attempt
   - Note exact error messages

2. **Check browser console** for errors

3. **Try connecting again** with DevTools open:
   - Go to Integrations page
   - Open DevTools (F12)  
   - Click "Connect Fathom"
   - Watch console for errors
   - Complete OAuth flow
   - Check Edge Function logs immediately after

---

## 📝 Report Back

After checking logs, tell me:

1. What errors (if any) appear in Edge Function logs?
2. What errors (if any) appear in browser console?
3. Did you see the "Successfully Connected!" message in the UI?
4. What is your exact Fathom redirect URI configured?

This will help pinpoint the exact issue!

---

## 🔗 Quick Links

- **Edge Function Logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions
- **Function Settings**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/settings/functions
- **SQL Editor**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor
- **Integrations Page**: http://localhost:5173/integrations
