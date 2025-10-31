# Fathom OAuth Token Refresh - Implementation Guide

## Problem Solved
**401 Unauthorized errors** from Fathom API due to expired OAuth access tokens.

## Solution Overview
Implemented automatic OAuth token refresh in the `fathom-sync` edge function that:
- ✅ Detects expired tokens (with 5-minute buffer)
- ✅ Automatically refreshes using stored `refresh_token`
- ✅ Updates database with new tokens
- ✅ Seamlessly continues API requests with fresh tokens

---

## Implementation Details

### 1. Token Refresh Function
**File:** `supabase/functions/fathom-sync/index.ts:77-146`

```typescript
async function refreshAccessToken(supabase: any, integration: any): Promise<string>
```

**Behavior:**
- Checks if token expires within 5 minutes
- Calls Fathom OAuth endpoint: `https://fathom.video/external/v1/oauth2/token`
- Uses `grant_type=refresh_token` with stored `refresh_token`
- Updates `fathom_integrations` table with new tokens
- Returns fresh `access_token` for immediate use

### 2. Integration Points
Updated `fetchFathomCalls()` to automatically refresh tokens before every API call:

```typescript
async function fetchFathomCalls(
  integration: any,
  params: {...},
  supabase?: any  // Optional for token refresh
): Promise<FathomCall[]>
```

### 3. Database Schema
**Table:** `fathom_integrations`

Key fields:
- `access_token` - OAuth access token (short-lived, ~1 hour)
- `refresh_token` - OAuth refresh token (long-lived, ~30-90 days)
- `token_expires_at` - Timestamp when access token expires
- `updated_at` - Last token refresh timestamp

---

## How It Works

### Normal Flow
```
1. Cron job or manual sync triggered
2. fathom-sync function called with user_id
3. Load integration from database
4. Before API call: Check token expiration
5. If expired or expiring soon (< 5 min):
   → Refresh token via OAuth
   → Update database
   → Use fresh token
6. Make Fathom API request
7. Success! ✅
```

### Token Refresh Flow
```
Check: token_expires_at - now < 5 minutes?
  ↓
YES → Refresh Token
  ↓
POST https://fathom.video/external/v1/oauth2/token
  grant_type: refresh_token
  refresh_token: <stored_refresh_token>
  client_id: <FATHOM_CLIENT_ID>
  client_secret: <FATHOM_CLIENT_SECRET>
  ↓
Response: {
  access_token: "new_token_123",
  refresh_token: "new_refresh_456",
  expires_in: 3600
}
  ↓
UPDATE fathom_integrations SET
  access_token = "new_token_123",
  refresh_token = "new_refresh_456",
  token_expires_at = now() + 3600 seconds,
  updated_at = now()
  ↓
Continue with fresh token ✅
```

---

## Troubleshooting

### Error: "401 Unauthorized"

**Possible Causes:**

1. **Both access_token AND refresh_token expired**
   - Refresh tokens typically expire after 30-90 days of inactivity
   - **Solution:** Reconnect Fathom integration in UI

2. **Invalid refresh_token**
   - User may have revoked access in Fathom settings
   - **Solution:** Disconnect and reconnect integration

3. **OAuth credentials missing/incorrect**
   - Environment variables not set: `VITE_FATHOM_CLIENT_ID`, `VITE_FATHOM_CLIENT_SECRET`
   - **Solution:** Verify environment variables in Supabase dashboard

### Diagnostic Steps

#### 1. Check Integration Status
Run this SQL in Supabase SQL Editor:

```sql
SELECT
  id,
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  CASE
    WHEN token_expires_at < NOW() THEN '❌ EXPIRED'
    WHEN token_expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ EXPIRING SOON'
    ELSE '✅ VALID'
  END as token_status,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 3600 as hours_until_expiry,
  last_sync_at,
  created_at,
  updated_at,
  LEFT(access_token, 10) || '...' as access_token_preview,
  CASE
    WHEN refresh_token IS NOT NULL AND LENGTH(refresh_token) > 0
    THEN '✅ Present'
    ELSE '❌ Missing'
  END as refresh_token_status
FROM fathom_integrations
WHERE is_active = true
ORDER BY created_at DESC;
```

#### 2. Check Cron Job Logs
```sql
SELECT
  job_name,
  user_id,
  status,
  message,
  error_details,
  created_at
FROM cron_job_logs
WHERE job_name = 'fathom_hourly_sync'
ORDER BY created_at DESC
LIMIT 20;
```

#### 3. Manual Test Token Refresh
From Supabase dashboard → Edge Functions → fathom-sync → Invoke:

```json
{
  "sync_type": "manual",
  "user_id": "<your_user_id>",
  "limit": 1
}
```

Watch logs for:
- `🔄 Access token expired or expiring soon, refreshing...`
- `✅ Access token refreshed successfully`
- `✅ Refreshed tokens stored successfully`

---

## Reconnecting Integration

If refresh token is expired, users must reconnect:

### UI Steps
1. Navigate to `/integrations`
2. Find Fathom integration card
3. Click "Disconnect" (if connected)
4. Click "Connect to Fathom"
5. Complete OAuth flow
6. New tokens stored automatically

### What Happens
```
1. User clicks "Connect to Fathom"
2. Redirected to Fathom OAuth: https://fathom.video/oauth/authorize
3. User grants permissions
4. Fathom redirects to: /functions/v1/fathom-oauth-callback
5. Callback exchanges code for tokens
6. Tokens stored in fathom_integrations:
   - access_token (1 hour expiry)
   - refresh_token (30-90 day expiry)
   - token_expires_at
7. Initial sync triggered automatically
```

---

## Environment Variables Required

Ensure these are set in Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
VITE_FATHOM_CLIENT_ID=<your_client_id>
VITE_FATHOM_CLIENT_SECRET=<your_client_secret>
VITE_FATHOM_REDIRECT_URI=https://<project>.supabase.co/functions/v1/fathom-oauth-callback
```

---

## Monitoring

### Success Indicators
- ✅ Hourly cron job completes without errors
- ✅ Manual syncs work from UI
- ✅ Webhooks process successfully
- ✅ `token_expires_at` updates automatically
- ✅ No 401 errors in function logs

### Warning Signs
- ⚠️ Token refresh failures in logs
- ⚠️ Cron jobs skipping users due to token expiry
- ⚠️ Multiple 401 errors for same user
- ⚠️ `refresh_token_status = Missing` in diagnostic SQL

---

## Technical Notes

### Token Lifespan
- **Access Token:** ~1 hour (varies by OAuth provider)
- **Refresh Token:** 30-90 days (typically 60 days for Fathom)
- **Buffer:** 5 minutes before expiry triggers refresh

### Rate Limiting
- Token refresh is rate-limited by Fathom OAuth endpoint
- Automatic retry with exponential backoff implemented
- Maximum 3 retry attempts with 2-second delays

### Security
- Tokens stored in PostgreSQL (not logged)
- Service role required for cron jobs
- Row Level Security (RLS) protects user tokens
- Only service role can access `refresh_token` field

---

## Next Steps

1. **Monitor for 24 hours** to ensure automatic refresh works
2. **Check cron logs** for any token refresh failures
3. **Notify users** if manual reconnection needed
4. **Set up alerts** for repeated 401 errors

---

## Files Modified

- ✅ `supabase/functions/fathom-sync/index.ts` - Added `refreshAccessToken()` function
- ✅ `supabase/functions/fathom-sync/index.ts` - Updated `fetchFathomCalls()` to accept supabase client
- ✅ Deployed to production with `npx supabase functions deploy fathom-sync`

---

## Support

If issues persist after following this guide:

1. Check environment variables are set correctly
2. Verify OAuth app credentials in Fathom developer console
3. Test with diagnostic SQL queries above
4. Check Supabase Edge Function logs for detailed errors
5. Consider re-creating OAuth app in Fathom if credentials compromised
