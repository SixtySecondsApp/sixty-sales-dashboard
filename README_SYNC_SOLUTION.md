# ✅ Solution: Sync Production to Development-v2

## The Problem

Your local PostgreSQL tools (pg_dump v14) are incompatible with Supabase's Postgres 15.

## ✅ Solution: Use GitHub Actions Workflow

The GitHub Actions workflow has the correct PostgreSQL version and will work perfectly!

### Steps:

1. **Verify GitHub Secrets** (you've already done this):
   - `SUPABASE_PROJECT_ID` = `ewtuefzeogytgmsnkpmb` ✅
   - `SUPABASE_ACCESS_TOKEN` = Your Supabase token ✅
   - `SUPABASE_DB_PASSWORD` = `SzPNQeGOhxM09pdX` ✅

2. **Run the Workflow**:
   - Go to: https://github.com/[your-repo]/actions
   - Click "Sync Production Data to Development"
   - Click "Run workflow"
   - Select branch: `main`
   - Click "Run workflow" button

3. **Check the Output**:
   Look for this line in the logs:
   ```
   Target: Development Branch (17b178b9-bb9b-4ccd-a125-5e49398bb989)
   ```
   
   Should be `17b178b9` (development-v2), NOT `68fc8173` (old branch)

4. **Verify**:
   After the workflow completes successfully, run:
   ```bash
   node check-dev-v2-directly.mjs
   ```

## Alternative: Upgrade Local PostgreSQL

If you want to sync locally in the future:

```bash
# macOS (Homebrew)
brew upgrade postgresql@15

# Update PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Verify
pg_dump --version  # Should show 15.x
```

## Why GitHub Actions is Better

- ✅ Correct PostgreSQL version (15.x)
- ✅ Reliable network connectivity
- ✅ Automated scheduling (weekly)
- ✅ Audit trail and logs
- ✅ No local environment issues

