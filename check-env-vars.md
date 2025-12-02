# Check Fathom OAuth Environment Variables

## How to Check

Go to **Supabase Dashboard → Settings → Edge Functions → Manage secrets**

Look for these two secrets:
- `FATHOM_CLIENT_ID`
- `FATHOM_CLIENT_SECRET`

## If They're Missing

### Get them from Fathom:
1. Go to https://fathom.video/
2. Navigate to Settings → API/Integrations
3. Find your OAuth application credentials
4. Copy the Client ID and Client Secret

### Add to Supabase:
```bash
# Option 1: Via Supabase Dashboard
# Go to: Settings → Edge Functions → Manage secrets
# Add:
#   FATHOM_CLIENT_ID = your_client_id_here
#   FATHOM_CLIENT_SECRET = your_client_secret_here

# Option 2: Via Supabase CLI
supabase secrets set FATHOM_CLIENT_ID=your_client_id_here
supabase secrets set FATHOM_CLIENT_SECRET=your_client_secret_here
```

## After Setting Env Vars

The token refresh will work automatically! No user action needed.

## Why This Matters

**Without these env vars:**
- ❌ Token refresh fails silently
- ❌ Users have to manually reconnect every 30-60 days
- ❌ Webhooks fail when tokens expire

**With env vars set:**
- ✅ Tokens auto-refresh before expiry
- ✅ Users authenticate once, works forever
- ✅ Webhooks continue working seamlessly
