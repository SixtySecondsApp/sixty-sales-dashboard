# Supabase Keys Migration Guide

## Overview

This project has been updated to use Supabase's new key terminology:
- **Publishable key** (formerly "anon key") - Safe for frontend/client-side use
- **Secret keys** (formerly "service role key") - Server-side only, never expose to browser

## Key Types

### Publishable Key (Frontend-Safe)
- **Purpose**: Client-side authentication and data access
- **Security**: Respects Row Level Security (RLS) policies
- **Exposure**: Safe to expose in frontend code
- **Environment Variable**: `VITE_SUPABASE_ANON_KEY` (kept for backward compatibility)
- **Usage**: Frontend React components, client-side Supabase client

### Secret Keys (Server-Side Only)
- **Purpose**: Server-side operations that bypass RLS
- **Security**: Bypasses all Row Level Security - full database access
- **Exposure**: **NEVER expose to browser/client-side code**
- **Environment Variable**: `SUPABASE_SERVICE_ROLE_KEY` (kept for backward compatibility)
- **Usage**: Edge functions, API routes, serverless functions, admin scripts

## Environment Variables

### Frontend (Vite - Exposed to Browser)
```env
# Safe to expose - Publishable key
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-publishable-key"
```

### Server-Side (Never Exposed to Browser)
```env
# Secret key - Server-side only
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-secret-key"
```

## Where to Set Keys

### Vercel Environment Variables

**For Frontend (Production/Preview/Development):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Publishable key

**For Serverless Functions (Production/Preview/Development):**
- `SUPABASE_URL` - Your Supabase project URL (without VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Secret key (without VITE_ prefix)
- `CRON_SECRET` - For cron job authentication

### Supabase Edge Functions Secrets

**Set in Supabase Dashboard → Edge Functions → Settings → Secrets:**
- `SUPABASE_URL` - Auto-provided
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided
- `ANTHROPIC_API_KEY` - For AI analysis
- `GOOGLE_CLIENT_ID` - For Google integrations
- `GOOGLE_CLIENT_SECRET` - For Google integrations
- `CRON_SECRET` - For cron authentication

## Security Best Practices

### ✅ DO:
- Use **Publishable key** (`VITE_SUPABASE_ANON_KEY`) in frontend code
- Use **Secret keys** (`SUPABASE_SERVICE_ROLE_KEY`) only in serverless functions
- Set Secret keys in Vercel environment variables (not VITE_ prefixed)
- Use Secret keys in Supabase Edge Functions (server-side only)

### ❌ DON'T:
- **NEVER** use `VITE_SUPABASE_SERVICE_ROLE_KEY` - This exposes Secret keys to the browser!
- **NEVER** commit Secret keys to git
- **NEVER** use Secret keys in frontend React components
- **NEVER** log Secret keys in console or error messages

## Code Examples

### Frontend (Safe - Uses Publishable Key)
```typescript
// src/lib/supabase/clientV2.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY; // Safe for frontend

const supabase = createClient(supabaseUrl, supabasePublishableKey);
```

### Serverless Function (Uses Secret Key)
```typescript
// api/cron/health-refresh.ts
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Server-side only

const response = await fetch(`${supabaseUrl}/functions/v1/endpoint`, {
  headers: {
    'Authorization': `Bearer ${supabaseSecretKey}`,
  },
});
```

### Edge Function (Uses Secret Key)
```typescript
// supabase/functions/my-function/index.ts
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseSecretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseSecretKey);
```

## Migration Checklist

- [x] Updated code comments to use new terminology
- [x] Removed `VITE_SUPABASE_SERVICE_ROLE_KEY` from frontend code
- [x] Updated API routes to use `SUPABASE_SERVICE_ROLE_KEY` (non-VITE_)
- [x] Added security warnings in code
- [ ] Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is removed from Vercel
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (without VITE_ prefix)
- [ ] Regenerate Secret key in Supabase if it was exposed
- [ ] Update team documentation

## Getting Your Keys

### From Supabase Dashboard

1. Go to: **Settings** → **API**
2. **Publishable key** (frontend-safe):
   - Labeled as "Publishable key" or "anon public" key
   - Use for: `VITE_SUPABASE_ANON_KEY`
3. **Secret key** (server-side only):
   - Labeled as "Secret key" or "service_role" key
   - Use for: `SUPABASE_SERVICE_ROLE_KEY`
   - **⚠️ Keep this secret!**

## Troubleshooting

### "Missing Supabase configuration" error
- Check that `SUPABASE_URL` is set (not just `VITE_SUPABASE_URL`)
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set (not `VITE_SUPABASE_SERVICE_ROLE_KEY`)

### Security warning about VITE_ prefixed keys
- Remove any `VITE_SUPABASE_SERVICE_ROLE_KEY` from Vercel
- Use `SUPABASE_SERVICE_ROLE_KEY` instead (without VITE_ prefix)

### Cron jobs not working
- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel
- These should NOT have `VITE_` prefix (serverless functions don't have access to VITE_ vars)

---

**Last Updated**: November 23, 2025
**Version**: 1.0

