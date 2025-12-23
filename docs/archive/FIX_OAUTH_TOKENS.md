# Fix OAuth Token Expiration Issue

## Problem

All Fathom OAuth tokens expired between Nov 27-29, 2025. This affects:
- Webhook processing (can't fetch transcripts)
- Cron sync (can't fetch new meetings)
- AI analysis (can't access Fathom API)

## Quick Status Check

Run this SQL to see which users need to reconnect:

```sql
SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  is_active,
  CASE
    WHEN token_expires_at < NOW() THEN 'EXPIRED'
    WHEN token_expires_at < NOW() + INTERVAL '7 days' THEN 'EXPIRING SOON'
    ELSE 'VALID'
  END as token_status
FROM fathom_integrations
ORDER BY token_expires_at ASC NULLS FIRST;
```

## Solution: Users Must Reconnect

Since tokens are expired, users need to reconnect their Fathom accounts via OAuth.

### Option 1: Manual Reconnection (Recommended)

1. **Notify Users**:
   - Send email/message to all users with expired tokens
   - Direct them to reconnect their Fathom account

2. **Users Reconnect**:
   - Go to Settings > Integrations in your app
   - Click "Disconnect" on Fathom integration
   - Click "Connect to Fathom" and authorize again
   - New tokens will be generated automatically

3. **Verify Connection**:
   ```sql
   -- Check if tokens are now valid
   SELECT
     user_id,
     fathom_user_email,
     token_expires_at,
     token_expires_at > NOW() as is_valid
   FROM fathom_integrations
   WHERE is_active = true
   ORDER BY token_expires_at DESC;
   ```

### Option 2: Bulk Deactivate and Notify

Force users to reconnect by deactivating expired integrations:

```sql
-- Deactivate all expired integrations
UPDATE fathom_integrations
SET
  is_active = false,
  updated_at = NOW()
WHERE token_expires_at < NOW();

-- Get list of affected users for notification
SELECT
  fi.user_id,
  fi.fathom_user_email,
  p.email as app_email,
  fi.token_expires_at
FROM fathom_integrations fi
LEFT JOIN profiles p ON p.id = fi.user_id
WHERE fi.is_active = false
  AND fi.token_expires_at < NOW();
```

### Option 3: Implement Auto-Refresh (Development Task)

Long-term solution: Implement OAuth token refresh logic.

**Required Changes**:

1. **Store Refresh Token** (if not already):
   ```sql
   -- Check if refresh_token column exists
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'fathom_integrations'
     AND column_name = 'refresh_token';
   ```

2. **Add Refresh Logic** to `fathom-sync`:
   - Detect expired tokens before API calls
   - Call Fathom's token refresh endpoint
   - Update `fathom_integrations` with new tokens
   - Retry the original request

3. **Scheduled Token Refresh**:
   - Add cron job to refresh tokens 1 week before expiry
   - Prevents disruption to users

## Why Tokens Expired

OAuth tokens typically expire after:
- 30 days (standard)
- 60 days (extended)
- 90 days (long-lived)

Your tokens expired Nov 27-29, suggesting:
1. Initial OAuth connection was ~30-60 days earlier
2. No refresh mechanism implemented
3. All users connected around the same time (onboarding?)

## Prevention

**Immediate Actions**:
1. Fix cron configuration (so it can alert on failures)
2. Set up webhook monitoring
3. Add token expiry alerts

**Long-term Solution**:
1. Implement automatic token refresh
2. Add monitoring for token expiry (7 days warning)
3. Graceful degradation when tokens expire

## Testing After Reconnection

After users reconnect, verify the system works:

```sql
-- Test sync for one user
SELECT * FROM fathom_integrations WHERE is_active = true LIMIT 1;

-- Trigger manual sync (replace user_id)
-- Call fathom-sync Edge Function via Supabase Dashboard or:
```

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/fathom-sync' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_type": "incremental",
    "user_id": "user-uuid-here"
  }'
```

## Next Steps

1. ✅ Fix cron configuration (see `fix-cron-config.sql`)
2. ✅ Set up Fathom webhooks (see `FATHOM_WEBHOOK_SETUP.md`)
3. 🔄 Notify users to reconnect Fathom OAuth
4. ✅ Reprocess meetings with missing AI analysis
5. 📊 Monitor sync logs for 48 hours to verify stability
