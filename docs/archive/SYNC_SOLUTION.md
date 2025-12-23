# ✅ Solution: Sync Production Data to Development-v2

## The Problem

Development-v2 branch had **0 records** and **0 auth users** because:
1. GitHub Actions workflow used `--data-only` which failed silently with 385 errors
2. The sync didn't include the `auth` schema (where auth.users live)
3. Missing tables like `internal_email_domains` caused 404 errors

## ✅ The Solution

Use the `scripts/sync-prod-to-dev-complete.sh` script which:
- ✅ Exports BOTH `public` AND `auth` schemas
- ✅ Uses Supabase CLI with correct PostgreSQL version
- ✅ Includes `--use-copy` for fast data transfer
- ✅ Handles preview branch connection automatically

## Quick Start

```bash
# Run the complete sync
./scripts/sync-prod-to-dev-complete.sh

# Wait for completion (~5-10 minutes)
# Then verify
node check-dev-v2-tables.mjs

# You should see:
# ✅ profiles: XX records
# ✅ deals: XX records
# ✅ meetings: XX records
# ✅ auth.users: XX users

# Start your app
npm run dev

# You can now log in with production credentials!
```

## What Gets Synced

### Public Schema (Your Data)
- profiles
- deals
- meetings
- activities
- contacts
- tasks
- organizations
- communication_events
- All other custom tables

### Auth Schema (Users)
- auth.users (so you can log in!)
- auth.identities
- auth.sessions
- auth.refresh_tokens

## Technical Details

### Connection Details
- **Production**: `ewtuefzeogytgmsnkpmb` via pooler (port 5432)
- **Development-v2**: `jczngsvpywgrlgdwzjbr` (Branch ID: `17b178b9...`)
- **Method**: Supabase CLI `db dump` → `psql` restore

### Why This Works
1. **Correct PostgreSQL Version**: Supabase CLI uses PG15 (your local is PG14)
2. **Auth Schema Included**: `--schema auth` exports user data
3. **Fast Transfer**: `--use-copy` uses COPY instead of INSERT
4. **Automatic Connection**: CLI gets correct branch connection details

## Troubleshooting

### If sync fails:
```bash
# Check the log
cat sync-complete-output.log

# Verify production connection
psql "postgres://postgres.ewtuefzeogytgmsnkpmb:SzPNQeGOhxM09pdX@aws-0-us-west-1.pooler.supabase.com:5432/postgres" -c "SELECT count(*) FROM auth.users;"

# Verify dev-v2 with service role key
node check-dev-v2-tables.mjs
```

### If you still can't log in:
1. Check auth.users has records: `node check-dev-v2-tables.mjs`
2. Try production credentials (they're now in dev-v2)
3. Check browser console for auth errors

## Automated Weekly Sync (Future)

The GitHub Actions workflow at `.github/workflows/supabase-sync-data.yml` will eventually handle this automatically, but it needs updates to include the auth schema.

## Notes

- **Safety**: This only affects development-v2, not production
- **Data Freshness**: Run the script whenever you need fresh data from production
- **Auth Users**: You can log in with any production user credentials
- **Local Development**: Your `.env` is already configured for development-v2
