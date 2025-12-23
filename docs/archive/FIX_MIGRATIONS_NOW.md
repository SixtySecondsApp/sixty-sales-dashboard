# Fix Migrations Issue - Action Plan

## Problem Identified

Your Supabase migrations are in an inconsistent state:

**Last Migration on Remote**: `20250903180000_create_unified_automations.sql` (September 3, 2025)

**Local Migrations with Earlier Timestamps**: 84+ migrations with timestamps from 2024-2025 that haven't been applied yet.

This creates a timeline paradox - Supabase can't apply migrations from the past when future migrations are already applied.

## Root Cause

Someone created a migration with a far-future timestamp (September 2025) and applied it, which now blocks all earlier migrations from being applied in chronological order.

## Solution: Use `--include-all` Flag

Supabase CLI provides a flag specifically for this situation:

```bash
supabase db push --include-all
```

This will apply ALL pending migrations regardless of timestamp order.

## Step-by-Step Fix

### 1. Backup Current Database (Safety First)

```bash
# Create a backup dump
supabase db dump -f backup_before_migration_fix.sql --data-only

# Store it safely
mkdir -p backups
mv backup_before_migration_fix.sql backups/
```

### 2. Review What Will Be Applied

```bash
# See what migrations will be applied
supabase db push --dry-run --include-all 2>&1 | tee migration_preview.txt
```

Review `migration_preview.txt` to ensure no surprises.

### 3. Apply All Pending Migrations

```bash
# Apply migrations with --include-all flag
supabase db push --include-all
```

### 4. Verify Success

```bash
# Check migration status
psql "postgres://postgres.ewtuefzeogytgmsnkpmb:IKYzK6buAvaLDMqy@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -c "SELECT COUNT(*) as applied_migrations FROM supabase_migrations.schema_migrations;"

# Verify branches are healthy
supabase branches list --experimental
```

Expected result: Both branches should show `ACTIVE` status instead of `MIGRATIONS_FAILED`.

### 5. Verify Development Branch

Once production migrations are fixed, the development branch should automatically inherit the fixed state:

```bash
# Check development branch status
supabase branches get 68fc8173-d1b9-47be-8920-9aa8218cc285 \
  --project-ref ewtuefzeogytgmsnkpmb \
  --output json | jq '.status'
```

Expected: `"ACTIVE"` instead of `"MIGRATIONS_FAILED"`

## After Migrations Are Fixed

### 1. Deploy Edge Functions

Edge functions are shared across all branches, so deploy once to production:

```bash
cd supabase/functions

# Deploy all functions
for dir in */; do
  func_name=$(basename "$dir")
  echo "Deploying $func_name..."
  supabase functions deploy "$func_name" --project-ref ewtuefzeogytgmsnkpmb
done
```

### 2. Switch Local Environment to Development Branch

Update `.env` to use development branch:

```env
# Development Branch Supabase URL
VITE_SUPABASE_URL=https://yjdzlbivjddcumtevggd.supabase.co

# Development Branch Anonymous Key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZHpsYml2amRkY3VtdGV2Z2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDg4NTYsImV4cCI6MjA4MDI4NDg1Nn0.MCZNcLG2jhtS4I8A9pIfHHbtj_Z-js7teTNGslDshQM

# Development Branch Service Role Key
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZHpsYml2amRkY3VtdGV2Z2dkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDcwODg1NiwiZXhwIjoyMDgwMjg0ODU2fQ.xdBbLn8qWztkFLFm3heSm5FgtiHXdF8o4kfh6vhIYrI

SUPABASE_DATABASE_PASSWORD=SK7B8MfdbBQ29HsI
SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb
```

### 3. Restart Dev Server

```bash
npm run dev
```

### 4. Test Connection

Visit the app and verify:
- ✅ No "API connection lost" errors
- ✅ Can log in successfully
- ✅ Data loads properly
- ✅ Edge functions work (health endpoint, etc.)

## Preventing Future Issues

### Migration Naming Convention

Always use the current date/time for migrations:

```bash
# Good - uses current timestamp
supabase migration new feature_name

# Bad - manual timestamp in the future
touch supabase/migrations/20250903000000_feature.sql
```

### Pre-Push Validation

Before pushing migrations, always check:

```bash
# 1. Dry run to preview
supabase db push --dry-run

# 2. If you see "include-all" warning, investigate why
# 3. Only use --include-all if you understand the timeline issue
```

## Troubleshooting

### If Migrations Still Fail

1. **Check for syntax errors** in migration files:
```bash
# Find migrations with potential syntax errors
for file in supabase/migrations/*.sql; do
  echo "Checking $file..."
  psql "postgres://postgres.ewtuefzeogytgmsnkpmb:IKYzK6buAvaLDMqy@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
    -f "$file" --dry-run 2>&1 | grep -i error
done
```

2. **Check for circular dependencies**:
   - Look for migrations that reference tables created in later migrations
   - Review foreign key constraints

3. **Check for conflicting migrations**:
   - Multiple migrations trying to create the same table
   - Conflicting ALTER TABLE statements

### If Edge Functions Don't Work After Deploy

```bash
# List deployed functions
supabase functions list --project-ref ewtuefzeogytgmsnkpmb

# Check function logs
supabase functions logs <function-name> --project-ref ewtuefzeogytgmsnkpmb

# Redeploy specific function
supabase functions deploy <function-name> --project-ref ewtuefzeogytgmsnkpmb --no-verify-jwt
```

## Expected Timeline

- **Migration fix**: 5-10 minutes
- **Edge function deployment**: 10-15 minutes (all functions)
- **Development branch becomes active**: Immediate after migrations fix
- **Local environment switch**: 1 minute

## Success Criteria

✅ `supabase branches list` shows both branches as `ACTIVE`
✅ `supabase db push --dry-run` reports no pending migrations
✅ Edge functions respond to requests
✅ Local development environment connects successfully
✅ Frontend shows no "API connection lost" errors
✅ Data sync workflow continues to work weekly

## Next Steps

1. Run the backup command above
2. Execute `supabase db push --include-all`
3. Deploy edge functions
4. Switch `.env` to development branch
5. Test the application thoroughly
6. Delete the temporary `FIX_DEVELOPMENT_SETUP.md` file (this guide supersedes it)
