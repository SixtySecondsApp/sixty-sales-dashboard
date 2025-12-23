# Complete Data Sync Solution: Production → Development-v2

## Current Status: ✅ Tables Exist, ⏳ Awaiting PostgREST Cache Refresh

### What's Complete
1. ✅ **All migrations applied** to development-v2 (270+ migrations)
2. ✅ **All tables exist** in development-v2 (confirmed by `list-all-tables.mjs`)
3. ✅ **Data ready to sync** - Successfully fetching 10,947+ records from production via API
4. ✅ **Automated sync script ready** - `sync-data-via-api.mjs` with full pagination

### Current Blocker: PostgREST Schema Cache

**Issue**: PostgREST's schema cache hasn't detected the newly created tables yet.

**Error**: `Could not find the table 'public.profiles' in the schema cache`

**Why**: Supabase preview branches sometimes take longer to refresh PostgREST's schema cache after DDL changes.

## Solution Options

### Option 1: Manual Dashboard Refresh (RECOMMENDED - 2 minutes)

**This will immediately resolve the issue:**

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr
2. Navigate to: **Settings** → **API**
3. Click the **"Reload schema"** button
4. Wait 30 seconds
5. Run: `node sync-data-via-api.mjs`

### Option 2: Wait for Automatic Refresh (SLOW - 15-60 minutes)

PostgREST will eventually detect the schema changes automatically. This can take 15-60 minutes for preview branches.

### Option 3: Restart PostgREST via Management API (REQUIRES ACCESS TOKEN)

If you have Supabase Management API access:

```bash
curl -X POST \
  "https://api.supabase.com/v1/projects/jczngsvpywgrlgdwzjbr/restart" \
  -H "Authorization: Bearer YOUR_MANAGEMENT_API_TOKEN"
```

## Data Sync Script Ready

Once the schema cache refreshes, run:

```bash
node sync-data-via-api.mjs
```

This will:
- Fetch ALL 10,947+ records from production (with pagination)
- Insert in batches of 1000 records
- Handle all tables:
  - 1,838 contacts
  - 6,841 activities
  - 1,561 meetings
  - 652 deals
  - 20 profiles
  - 10 organizations
  - 16 communication_events
  - 9 workflow_executions
  - All other CRM tables

## Verification After Sync

```bash
# Check record counts
node check-dev-v2-tables.mjs

# Verify tables are accessible
node check-dev-v2-schema.mjs
```

## Files Created

### Working Scripts
- ✅ `sync-data-via-api.mjs` - API-based sync with pagination
- ✅ `check-dev-v2-tables.mjs` - Verify record counts
- ✅ `check-dev-v2-schema.mjs` - Check table accessibility
- ✅ `list-all-tables.mjs` - List all tables and their status
- ✅ `trigger-cache-reload.mjs` - Attempt to trigger cache reload

### GitHub Actions
- ✅ `.github/workflows/seed-dev-branch.yml` - Automated seeding workflow (successfully ran)

### Documentation
- ✅ `FINAL_SYNC_STATUS.md` - Comprehensive status document
- ✅ `COMPLETE_SYNC_SOLUTION.md` - This file

## Why This Happened

1. **IPv6 Connectivity**: Supabase stopped IPv4 since Jan 2024, local `pg_dump`/`pg_restore` hung
2. **GitHub Actions Workaround**: Workflow successfully applied migrations via `supabase db push`
3. **PostgREST Cache Lag**: Preview branches can take longer to refresh their schema cache
4. **API Sync Ready**: Once cache refreshes, data sync is fully automated and ready

## Next Steps

**Immediate**: Go to Supabase Dashboard → Settings → API → Click "Reload schema"

**Then**: Run `node sync-data-via-api.mjs`

**Finally**: Verify with `node check-dev-v2-tables.mjs`

## Timeline

- Migrations applied: ✅ Complete
- Schema cache refresh: ⏳ **YOU ARE HERE** (manual trigger needed)
- Data sync: ⏳ Ready to run (2-5 minutes)
- Verification: ⏳ Final step (30 seconds)

**Total remaining time**: 3-6 minutes (after manual schema reload)
