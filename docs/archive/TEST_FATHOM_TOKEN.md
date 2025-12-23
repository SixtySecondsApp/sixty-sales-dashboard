# Test Fathom Token - Diagnostic Tool

## Purpose

This Edge Function tests if your stored Fathom access token is valid and working with the Fathom API.

## How to Use

### Option 1: Using curl

```bash
# Replace YOUR_SUPABASE_ANON_KEY and YOUR_USER_JWT_TOKEN
curl -X POST \
  https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY"
```

### Option 2: Using JavaScript in Browser Console

```javascript
// Run this in your app's browser console when logged in
const response = await fetch(
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
      'apikey': 'YOUR_SUPABASE_ANON_KEY'
    }
  }
);
const result = await response.json();
console.log(result);
```

### Option 3: Add a Test Button in Your UI

Add this to your Integrations page:

```typescript
const testFathomToken = async () => {
  const { data, error } = await supabase.functions.invoke('test-fathom-token');
  console.log('Test result:', data);
  alert(data.message);
};

// In your JSX
<button onClick={testFathomToken}>
  Test Fathom Connection
</button>
```

## Understanding the Results

### Success Response (Token Valid) ✅

```json
{
  "success": true,
  "message": "✅ Token is valid and working!",
  "integration": {
    "id": "abc-123",
    "email": "user@example.com",
    "expires_at": "2025-10-25T10:00:00Z",
    "scopes": ["public_api"]
  },
  "api_test": {
    "status": 200,
    "meetings_count": 5,
    "has_cursor": true
  }
}
```

**What this means:**
- ✅ Your Fathom token is valid
- ✅ API connection is working
- ✅ You can proceed with full sync
- ✅ Meetings are being returned

**Next step:** Run a full sync - it should work!

### Failure Response (Token Invalid) ❌

```json
{
  "success": false,
  "message": "❌ Token is invalid or expired",
  "error": {
    "status": 401,
    "body": {
      "error": "unauthorized",
      "message": "Invalid API key"
    }
  },
  "integration": {
    "id": "abc-123",
    "email": "user@example.com",
    "expires_at": "2025-10-20T10:00:00Z",
    "scopes": ["public_api"],
    "token_preview": "eyJhbGciOiJIUzI1NiIs..."
  },
  "recommendation": "Please reconnect your Fathom account in the Integrations page"
}
```

**What this means:**
- ❌ Your token is expired or invalid
- ❌ Token was likely created with old OAuth flow
- ❌ You need to reconnect Fathom

**Next step:** Reconnect your Fathom account

### How to Reconnect Fathom

1. **Go to Integrations page** in your app
2. **Find Fathom integration**
3. **Click "Disconnect"** (if currently connected)
4. **Click "Connect Fathom"**
5. **Authorize in OAuth popup**
6. **Run test again** to verify

## Common Issues

### Issue 1: "No active Fathom integration found"

**Solution:** You haven't connected Fathom yet. Go to Integrations and connect.

### Issue 2: Token expired but test says valid

**Check:**
```json
{
  "expires_at": "2025-10-20T10:00:00Z"  // Past date = expired
}
```

If `expires_at` is in the past, the token refresh should happen automatically on next sync.

### Issue 3: 401 Error but token not expired

**Possible causes:**
1. Token created with old OAuth flow (before API fix)
2. Scopes changed or revoked
3. Fathom account access revoked

**Solution:** Reconnect Fathom account to generate fresh tokens.

### Issue 4: Network errors

**Check:**
- Fathom API status: https://status.fathom.video
- Supabase Edge Function logs
- Your internet connection

## What the Test Shows

The test function will log detailed information:

```
🧪 Testing Fathom token for user: abc-123-def
📋 Integration details:
  - ID: xyz-789
  - Email: user@example.com
  - Token expires: 2025-10-25T10:00:00.000Z
  - Scopes: ["public_api"]
  - Token length: 256
  - Token preview: eyJhbGciOiJIUzI1NiIs...
🧪 Testing token with Fathom API...
📡 Calling: https://api.fathom.ai/external/v1/meetings
📊 Response status: 200
📦 Response body: { meetings: [...], cursor: "...", has_more: true }
```

**Look for:**
- Token length should be >100 characters
- Token should start with standard JWT prefix (e.g., "ey...")
- Response status should be 200
- Response should contain "meetings" array

## Checking Supabase Logs

View detailed logs:
```
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/test-fathom-token/logs
```

## Next Steps After Testing

### If Test Passes ✅
1. Run a limited sync: `{ "sync_type": "manual", "limit": 5 }`
2. Verify meetings appear in database
3. Run full sync if test sync works
4. Set up automated syncs

### If Test Fails ❌
1. **First:** Try reconnecting Fathom account
2. **Second:** Check token expiry in database
3. **Third:** Verify OAuth credentials in environment variables
4. **Fourth:** Check Fathom app settings for revoked access

## SQL Queries for Manual Debugging

### Check integration status
```sql
SELECT
  id,
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  created_at,
  scopes
FROM fathom_integrations
WHERE user_id = 'YOUR_USER_ID';
```

### Force token to expire (triggers refresh)
```sql
UPDATE fathom_integrations
SET token_expires_at = NOW() - INTERVAL '1 hour'
WHERE user_id = 'YOUR_USER_ID';
```

### Check sync state
```sql
SELECT * FROM fathom_sync_state
WHERE user_id = 'YOUR_USER_ID';
```

---

**Quick Diagnosis:**

1. Run test → See 401 → Reconnect Fathom
2. Run test → See 200 → Token works! Run full sync
3. Run test → See error → Check logs and reconnect

The test function makes diagnosis instant and precise! 🎯
