# Data Sync Instructions

Your production data export is ready! However, the development branch DNS needs a few minutes to propagate before we can restore it.

## Option 1: Wait and Retry (Recommended for Now)

Wait 5-10 minutes for DNS propagation, then run:

```bash
/opt/homebrew/Cellar/postgresql@15/15.13/bin/pg_restore \
  --dbname='postgresql://postgres:kbpjsDPWVsFqGtZrgHYVMOkHvOyUZRpA@db.yjdzlbivjddcumtevggd.supabase.co:5432/postgres' \
  --no-owner \
  --no-acl \
  --verbose \
  production_dump.dump
```

## Option 2: Use GitHub Actions (Easiest)

Once you've added the GitHub Secrets (from SETUP_STATUS.md), you can trigger the data sync workflow:

1. Go to: https://github.com/SixtySecondsApp/sixty-sales-dashboard/actions
2. Click "Sync Production Data to Development"
3. Click "Run workflow" → Select "main" branch → "Run workflow"

This will handle the entire sync process automatically!

##  Option 3: Manual Restore (Later)

Once DNS resolves, the full sync command is:

```bash
export SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb
export SUPABASE_ACCESS_TOKEN=sbp_8e5eef8735fc3f15ed2544a5ad9508a902f2565f
export PRODUCTION_DB_URL='postgresql://postgres.ewtuefzeogytgmsnkpmb:Dy54r9qXPH5XU4dx@aws-0-us-west-1.pooler.supabase.com:6543/postgres'
export DEVELOPMENT_DB_URL='postgresql://postgres:kbpjsDPWVsFqGtZrgHYVMOkHvOyUZRpA@db.yjdzlbivjddcumtevggd.supabase.co:5432/postgres'

./scripts/sync-prod-to-dev.sh
```

---

## Current Status

✅ Production data exported successfully (7.7MB in `production_dump.dump`)
⏳ Waiting for development branch DNS to propagate
✅ All configuration is ready

**Next**: Try Option 1 in 5 minutes, or set up GitHub Secrets and use Option 2!
