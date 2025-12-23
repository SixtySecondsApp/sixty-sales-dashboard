# Fix Development Branch Setup

## Current Situation

Your Supabase setup has:
- **Production Project**: `ewtuefzeogytgmsnkpmb` (main branch) - Status: ⚠️ MIGRATIONS_FAILED
- **Development Branch**: `68fc8173-d1b9-47be-8920-9aa8218cc285`
  - Has its own project ref: `yjdzlbivjddcumtevggd`
  - Status: ⚠️ MIGRATIONS_FAILED
  - Gets production data synced weekly

## Problems

1. ✅ **Good**: Development branch exists and gets data synced
2. ❌ **Bad**: Both production and development have failed migrations
3. ❌ **Bad**: Edge functions not deployed to development branch
4. ❌ **Bad**: Your local `.env` points to development branch without working schema

## Solution Plan

### Step 1: Fix Production Migrations First

Production migrations must work before branch migrations can work.

```bash
# Link to production project
supabase link --project-ref ewtuefzeogytgmsnkpmb

# Check which migrations failed
supabase db push --dry-run

# Fix any failing migrations, then push
supabase db push
```

### Step 2: Deploy Edge Functions to Production

Edge functions automatically work across all branches in the same project.

```bash
# Deploy all edge functions to production
supabase functions deploy --project-ref ewtuefzeogytgmsnkpmb

# Or deploy specific functions
supabase functions deploy fathom-sync --project-ref ewtuefzeogytgmsnkpmb
supabase functions deploy fathom-webhook --project-ref ewtuefzeogytgmsnkpmb
# ... etc for all functions
```

### Step 3: Fix Development Branch Migrations

Once production migrations work, the development branch should inherit them.

```bash
# The weekly data sync workflow will handle this, or trigger manually:
# Go to GitHub Actions → Sync Production Data to Development → Run workflow
```

### Step 4: Update Local Environment

**Option A: Use Development Branch** (Recommended after fixes)
```env
# .env - Development branch within production project
VITE_SUPABASE_URL=https://yjdzlbivjddcumtevggd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DATABASE_PASSWORD=SK7B8MfdbBQ29HsI
```

**Option B: Use Production Temporarily** (Quick fix for now)
```env
# .env - Production project
VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DATABASE_PASSWORD=IKYzK6buAvaLDMqy
```

## Quick Fix for Immediate Development

**For right now, use production**:

1. Update `.env`:
```bash
# Backup current .env
cp .env .env.dev-branch-backup

# Use production temporarily
cat > .env << 'EOF'
# TEMPORARY: Using production for local development
# Will switch back to development branch once migrations are fixed

VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs

SUPABASE_ACCESS_TOKEN=sbp_8e5eef8735fc3f15ed2544a5ad9508a902f2565f
SUPABASE_DATABASE_PASSWORD=IKYzK6buAvaLDMqy
SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb

# Keep all your other env vars below...
EOF
```

2. Restart dev server:
```bash
# Stop current server (Ctrl+C)
npm run dev
```

3. You should now be able to log in and develop!

## Longer-Term Fix (Do This After Quick Fix Works)

### 1. Fix Production Migrations

Check your latest migration files for syntax errors:

```bash
# List recent migrations
ls -lt supabase/migrations/ | head -10

# Check the problematic migration
# Look for common issues:
# - Missing semicolons
# - Invalid SQL syntax
# - References to non-existent tables
# - Circular dependencies
```

### 2. Deploy Edge Functions

```bash
# Login to Supabase
supabase login

# Link to production project
supabase link --project-ref ewtuefzeogytgmsnkpmb

# Deploy all functions
cd supabase/functions
for dir in */; do
  func_name=$(basename "$dir")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name" --project-ref ewtuefzeogytgmsnkpmb
done
```

### 3. Verify Development Branch

Once production is fixed:

```bash
# Manually trigger data sync to development branch
# Go to GitHub Actions → "Sync Production Data to Development" → Run workflow

# Or wait for next Sunday 2 AM UTC automatic sync
```

### 4. Switch Back to Development Branch

Once migrations and functions are deployed:

```bash
# Restore development branch .env
cp .env.dev-branch-backup .env

# Restart dev server
npm run dev
```

## Why Development Branch is Better

Once fixed, using the development branch gives you:

✅ **Safe testing** - Real production data without affecting production
✅ **Isolated development** - Your changes don't impact production users
✅ **Weekly fresh data** - Automatic sync of production data every Sunday
✅ **Shared functions** - Edge functions work across all branches
✅ **Automatic schema** - Migrations apply to branch automatically

## Need Help?

If migrations keep failing, we can:
1. Review the failing migration files
2. Create a fix migration
3. Use the GitHub Actions workflow to deploy properly

The key is: **Production migrations must work first** before branch migrations will work.
