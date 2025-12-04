# Manual Sync Guide: Production → Development-v2

## The Problem

Your local machine has IPv6 connectivity issues with Supabase, causing all `pg_dump`, `pg_restore`, and `supabase db push` commands to hang. This is a known issue since January 2024 when Supabase stopped assigning IPv4 addresses to direct database connections.

## ✅ Solution: Manual Dashboard + API Approach

### Step 1: Apply Migrations via Supabase Dashboard

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select development-v2 project**: `jczngsvpywgrlgdwzjbr`
3. **Navigate to**: SQL Editor
4. **Copy all migration files** from `supabase/migrations/` and run them **in order** (sorted by filename)

**OR** use the Migration Tool:
1. Go to **Database** → **Migrations**
2. Click **"Sync from Git"** or manually apply each migration file

### Step 2: Sync Data via API

Once migrations are applied, run this script:

```bash
node sync-data-via-api.mjs
```

This script:
- ✅ Uses HTTPS (no IPv6 issues)
- ✅ Fetches from production: 652 deals, 1000 contacts, 1000 meetings, etc.
- ✅ Inserts into development-v2

### Step 3: Verify

```bash
node check-dev-v2-tables.mjs
```

You should see:
```
✅ profiles: XX records
✅ deals: 652 records
✅ contacts: 1000 records
✅ meetings: 1000 records
✅ auth.users: XX users
```

## Alternative: Use GitHub Actions

The GitHub Actions workflow at `.github/workflows/supabase-sync-data.yml` is configured to use Supavisor Session Mode (port 5432) which works in IPv4-only environments.

**Update the workflow** to target development-v2 and manually trigger it from GitHub Actions tab.

## Why This Works

1. **API Sync**: Uses HTTPS which doesn't have IPv6 issues
2. **Dashboard Migrations**: Supabase Dashboard connects server-side (no local IPv6 issues)
3. **GitHub Actions**: Uses Supavisor Session Mode (IPv4 compatible)

## Current Status

✅ **Production data accessible**: Successfully fetched via API
- 20 profiles
- 10 organizations
- 1000 contacts
- 652 deals
- 1000 activities
- 1000 meetings
- 16 communication_events
- 9 workflow_executions

❌ **Development-v2 schema missing**: Tables don't exist yet (need migrations)

## Next Steps

1. Apply migrations to development-v2 (Dashboard or GitHub Actions)
2. Run `node sync-data-via-api.mjs`
3. Run `npm run dev` and log in with production credentials
