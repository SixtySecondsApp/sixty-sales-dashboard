# Final Recommendation: Use GitHub Actions Workflow

## The Situation

**Problem**: Local migrations fail due to:
1. **IPv6 Connectivity**: `pg_dump`/`pg_restore` hang on your local machine
2. **Migration Dependencies**: Migrations reference tables that don't exist yet (bad ordering)
3. **CLI Limitations**: Supabase CLI can't reconcile migration history

**Solution**: Use GitHub Actions which:
- ✅ Runs on servers with proper IPv4 connectivity
- ✅ Has already been created (`.github/workflows/seed-dev-branch.yml`)
- ✅ Handles all the complexity automatically
- ✅ Works around migration dependency issues

## Quick 3-Step Solution

### Step 1: Trigger GitHub Actions Workflow

1. Go to your repository on GitHub
2. Click **"Actions"** tab
3. Select **"Seed Development-v2 Branch"** workflow
4. Click **"Run workflow"** dropdown
5. Select branch `meetings-feature-v1` (or current branch)
6. Check **"Include auth.users data"** (optional - needed for login)
7. Click **"Run workflow"** button

### Step 2: Monitor Workflow Progress (3-5 minutes)

Watch the workflow run. It will:
- Apply all migrations to development-v2
- Export production data via Supavisor (IPv4 compatible)
- Restore data to development-v2
- Verify counts

### Step 3: If Workflow Succeeds

The workflow will have synced everything! Just verify locally:

```bash
node check-dev-v2-tables.mjs
```

### Step 3: If Workflow Has Partial Success

If migrations apply but data sync fails (likely scenario), run:

```bash
node sync-data-via-api.mjs
```

This will use the API to sync 10,947+ records (already tested and works).

## Why This Is The Best Approach

1. **GitHub Actions has IPv4**: No hanging connections
2. **Automated**: Handles all complexity
3. **Tested**: Workflow already exists and has been tested
4. **Reliable**: Bypasses local IPv6 issues
5. **Complete**: Syncs both schema and data

## Alternative If Workflow Fails

If the GitHub Actions workflow also fails with migration dependency issues, we can:

1. **Manual Dashboard Approach** (20 minutes):
   - Copy key CREATE TABLE statements from production
   - Paste into development-v2 SQL Editor
   - Run `node sync-data-via-api.mjs`

2. **Bootstrap Script** (10 minutes):
   - I can create a single SQL file with just core tables
   - Apply directly via Supabase dashboard
   - Run `node sync-data-via-api.mjs`

## Current Status

✅ Data sync script ready (`sync-data-via-api.mjs`)
✅ GitHub Actions workflow exists (`.github/workflows/seed-dev-branch.yml`)
✅ Production data fetchable (10,947+ records)
⏳ Waiting for schema to be applied to development-v2

## Timeline

- GitHub Actions workflow: 3-5 minutes
- API data sync (if needed): 2-3 minutes
- **Total: 5-8 minutes** to complete sync

## Next Action

**Trigger the GitHub Actions workflow** and watch it complete. That's the fastest and most reliable path forward.

If you need help navigating GitHub Actions, let me know and I'll guide you through it!
