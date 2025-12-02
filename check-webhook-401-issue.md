# Investigating Webhook 401 Error

## The Problem

Webhook is returning 401 before the function code even runs:
- `execution_id: null` → Function never executed
- `status_code: 401` → Authentication failure
- No logs from the function

## Possible Causes

### 1. JWT Verification Enabled on Function

Check if the function has `verify_jwt: true` in its config.

**Check via Dashboard:**
- Go to: Edge Functions → fathom-webhook → Settings
- Look for "JWT Verification" toggle
- Should be **DISABLED** for webhooks

**Check via CLI:**
```bash
# Check function config
supabase functions list
```

### 2. Missing Anonymous Access

Webhooks need to be publicly accessible (no auth required).

**Fix:**
Make sure the function allows anonymous access in `supabase/functions/fathom-webhook/index.ts`:
```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // ... rest of handler
})
```

### 3. Edge Runtime Configuration

Check if there's a config file blocking access.

**Check for:**
- `supabase/functions/fathom-webhook/.env`
- Any authorization middleware

## Quick Fix

The webhook should NOT require authentication. Let me check the deployment configuration.
