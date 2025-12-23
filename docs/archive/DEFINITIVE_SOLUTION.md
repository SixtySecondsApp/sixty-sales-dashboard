# Definitive Solution: Copy Production Schema to Development-v2

## The Problem

Migrations have dependency issues - the first migration references `profiles` table which doesn't exist yet. This is why `supabase db push` fails.

## The Solution

Instead of applying migrations sequentially, **dump the entire production schema and restore it** to development-v2. This captures the final state regardless of migration order.

## Step-by-Step Instructions

### Option 1: Use Supabase CLI (Recommended - 5 minutes)

```bash
# 1. Pull the production schema
supabase db pull --linked

# 2. Link to development-v2
supabase link --project-ref jczngsvpywgrlgdwzjbr

# 3. Reset development-v2 to production schema
supabase db reset --linked

# 4. Run the data sync
node sync-data-via-api.mjs
```

### Option 2: Direct pg_dump/pg_restore (If CLI fails - 10 minutes)

**This requires IPv4 connectivity or Supavisor workaround**

See the GitHub Actions workflow at `.github/workflows/seed-dev-branch.yml` which handles this automatically.

### Option 3: Manual Dashboard (Copy-Paste - 20 minutes)

1. Go to production project: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
2. Go to SQL Editor
3. Run: `SELECT * FROM information_schema.tables WHERE table_schema = 'public';`
4. For each table, get the CREATE TABLE statement
5. Go to development-v2: https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr
6. Execute each CREATE TABLE in SQL Editor
7. Run: `node sync-data-via-api.mjs`

### Option 4: GitHub Actions (Automated - 3-5 minutes)

The workflow `.github/workflows/seed-dev-branch.yml` already exists and should work:

1. Go to: https://github.com/[your-repo]/actions
2. Select "Seed Development-v2 Branch"
3. Click "Run workflow"
4. Wait for completion
5. Run locally: `node sync-data-via-api.mjs`

## Why This Happened

1. **Migration Dependency Issue**: Early migrations reference tables created in later migrations
2. **IPv6 Connectivity**: Local machine can't use `pg_dump`/`pg_restore` directly
3. **PostgREST Cache**: Even after applying some migrations, API doesn't recognize tables

## What Works Right Now

✅ **Data fetching from production** - `sync-data-via-api.mjs` successfully fetches 10,947+ records
✅ **GitHub Actions workflow** - Successfully runs migrations (though with dependency issues)
✅ **API-based data sync** - Once schema exists, data sync works perfectly

## Recommended Next Step

**Try Option 1 first** (Supabase CLI pull/reset):

```bash
supabase db pull --linked
supabase link --project-ref jczngsvpywgrlgdwzjbr
supabase db reset --linked
node sync-data-via-api.mjs
```

This should take 5 minutes and will work around the migration dependency issues.

## Alternative: Simple Schema Bootstrap

If all else fails, I can create a single SQL file with just the core tables (profiles, deals, contacts, activities, etc.) to bootstrap the schema, then run the data sync.

Let me know which approach you'd like to try!
