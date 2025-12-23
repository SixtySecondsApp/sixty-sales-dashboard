# Fathom Authentication Troubleshooting Guide

## Current Issue: 401 Unauthorized

The Fathom API is returning a 401 error, which means the authentication credentials are invalid or expired.

## Quick Fix Steps

### Option 1: Reconnect Fathom Account (Recommended)

1. **Go to Integrations page** in your app
2. **Disconnect Fathom** (if connected)
3. **Click "Connect Fathom"** again
4. **Authorize the app** in Fathom's OAuth screen
5. **Test sync** with a small limit (5 meetings)

This will generate fresh OAuth tokens using the corrected API endpoints.

### Option 2: Check Token Validity in Database

Run this query in Supabase SQL Editor:

```sql
SELECT
  id,
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  created_at,
  updated_at,
  scopes,
  LENGTH(access_token) as token_length,
  SUBSTRING(access_token, 1, 10) || '...' as token_preview
FROM fathom_integrations
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 1;
```

**Check if:**
- ✅ Token exists and has reasonable length (>20 characters)
- ✅ `token_expires_at` is in the future
- ✅ `scopes` includes necessary permissions
- ✅ `is_active` is true

### Option 3: Manual Token Refresh

If token is expired, trigger a refresh by updating the expiry:

```sql
-- Force token refresh on next API call
UPDATE fathom_integrations
SET token_expires_at = NOW() - INTERVAL '1 hour'
WHERE is_active = true;
```

Then trigger a sync - it should auto-refresh the token.

## Understanding the Error

### What Changed

**Before (incorrect):**
```typescript
headers: {
  'Authorization': `Bearer ${token}`
}
```

**After (correct):**
```typescript
headers: {
  'X-Api-Key': token
}
```

### Why 401 Can Happen

1. **Old tokens** - Generated with old OAuth flow before API fix
2. **Expired tokens** - Past `token_expires_at` date
3. **Invalid format** - Token not properly exchanged during OAuth
4. **Wrong scopes** - Missing required API scopes
5. **Revoked access** - User revoked app access in Fathom settings

## Checking Edge Function Logs

View detailed logs in Supabase Dashboard:

```
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/fathom-sync/logs
```

**Look for these log lines:**
- `✅ Found integration:` - Shows token info
- `🔑 Using token:` - Shows first 10 chars of token
- `📊 Response status:` - Shows HTTP status code
- `❌ API Error Response:` - Shows exact error from Fathom

## Testing the Fix

### Test Sync with Limited Results

Use this request body to test with just 5 meetings:

```json
{
  "sync_type": "manual",
  "limit": 5
}
```

### Expected Log Output (Success)

```
🔄 Starting Fathom sync for user (authenticated): abc-123
✅ Found integration: { id: xyz, fathom_user_email: user@example.com, ... }
📡 Fetching from: https://api.fathom.ai/external/v1/meetings?created_after=...
🔑 Using token: eyJhbGciOi...
📊 Response status: 200
📦 Response data structure: ["meetings", "cursor", "has_more"]
📦 Fetched 5 calls (offset: 0)
✅ Sync complete: 5/5 meetings synced
```

### Expected Log Output (Auth Error)

```
🔄 Starting Fathom sync for user (authenticated): abc-123
✅ Found integration: { id: xyz, fathom_user_email: user@example.com, ... }
📡 Fetching from: https://api.fathom.ai/external/v1/meetings?created_after=...
🔑 Using token: invalid_tok...
📊 Response status: 401
❌ API Error Response: {"error": "unauthorized", "message": "Invalid API key"}
❌ Sync error: Error: Fathom API error: 401 - ...
```

## Common Solutions

### Solution 1: Fresh OAuth Connection

**Most reliable fix** - Reconnect your Fathom account:

1. The OAuth flow now uses correct endpoints
2. Fresh tokens will be generated properly
3. Scopes will be set correctly
4. Token expiry will be accurate

### Solution 2: Check Fathom API Key Type

Fathom has **two types of authentication**:

1. **OAuth Tokens** (what we're using)
   - For third-party integrations
   - Obtained via OAuth flow
   - Refreshable with refresh token

2. **Personal API Keys** (alternative)
   - Generated in Fathom Settings
   - Don't expire
   - Can be used instead of OAuth

If OAuth continues to fail, consider switching to Personal API Keys.

## Verifying OAuth Configuration

Check your environment variables:

```bash
# .env or Supabase secrets
VITE_FATHOM_CLIENT_ID=your_client_id
VITE_FATHOM_CLIENT_SECRET=your_client_secret
VITE_FATHOM_REDIRECT_URI=https://your-domain.com/oauth/fathom/callback
```

**Verify in Fathom:**
1. Go to https://app.fathom.video/settings/integrations
2. Find your OAuth app
3. Check redirect URI matches exactly
4. Verify client ID and secret

## Next Steps

1. **Try reconnecting** - Simplest and most effective
2. **Check logs** - See what token is being used
3. **Verify OAuth config** - Ensure credentials are correct
4. **Test with curl** - Verify token works outside your app

### Test Token with curl

```bash
# Replace YOUR_TOKEN with actual access token from database
curl -H "X-Api-Key: YOUR_TOKEN" \
  https://api.fathom.ai/external/v1/meetings

# Should return meetings if token is valid
# Should return 401 if token is invalid
```

## Support

If issues persist:

1. Check Fathom API status: https://status.fathom.video
2. Review Fathom docs: https://developers.fathom.ai
3. Check Supabase logs: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
4. Verify Edge Function environment variables are set correctly

---

**Current Status:**
- ✅ DNS issue resolved (api.fathom.ai works)
- ✅ Correct endpoints implemented
- ✅ Retry logic added
- ⚠️  401 authentication error - needs token refresh or reconnection
