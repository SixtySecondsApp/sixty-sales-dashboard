# Supabase Database Pipeline: Complete CI/CD Implementation

**Last Updated**: December 3, 2025
**Development Branch**: `development-v2` (ID: `17b178b9-bb9b-4ccd-a125-5e49398bb989`)
**Status**: ✅ Fully Operational

---

## Overview

A fully automated database pipeline for the Sixty Sales Dashboard, implementing industry best practices for schema management, data synchronization, and deployment automation across production and development environments.

## Architecture

### Project Structure
- **Production Project**: `ewtuefzeogytgmsnkpmb` (main branch)
- **Development Branch**: `development-v2` (preview branch within production project)
- **Schema Management**: Git-tracked migrations in `supabase/migrations/`
- **Function Sharing**: Edge functions automatically work across all branches

### Key Benefits
- ✅ **Zero-Downtime Deployments**: Migrations apply without service interruption
- ✅ **Automatic Validation**: Pre-merge checks prevent deployment failures
- ✅ **Comprehensive Audit Trail**: Full deployment history via git tags
- ✅ **Realistic Testing**: Weekly production data sync to development
- ✅ **Manual Intervention Eliminated**: Complete automation from PR to production

---

## Three-Tier Workflow System

### 1️⃣ Pull Request Validation (`supabase-pr.yml`)

**Trigger**: When PR is created/updated with changes to:
- `supabase/migrations/**`
- `.github/workflows/supabase-pr.yml`

**What It Does**:
1. **Validates SQL Syntax**: Parses migration files for syntax errors
2. **Checks Naming Convention**: Enforces `YYYYMMDDHHMMSS_description.sql` format
3. **Identifies Dangerous Operations**: Warns about CASCADE deletions, DELETE statements
4. **Auto-Comments on PR**: Summarizes migration changes with deployment warning

**Validation Rules**:
```sql
-- ✅ GOOD: Follows naming convention
20251203120000_add_customer_table.sql

-- ❌ BAD: Invalid naming
add_customer_table.sql
```

**Example PR Comment**:
```markdown
## 📊 Database Migration Summary

This PR includes **2** migration file(s):
- `supabase/migrations/20251203120000_add_customer_table.sql`
- `supabase/migrations/20251203120100_add_customer_indexes.sql`

⚠️ **Note**: These migrations will be applied to Production when this PR is merged to `main`.

✅ Migration validation passed.
```

**Safety Checks**:
- ⚠️ Warns on `DROP TABLE ... CASCADE`
- ⚠️ Warns on `DELETE FROM` statements
- ❌ Blocks on invalid SQL syntax
- ❌ Blocks on incorrect naming convention

---

### 2️⃣ Automatic Production Deployment (`supabase-production.yml`)

**Trigger**: When code is merged to `main` with changes to:
- `supabase/migrations/**`
- `supabase/functions/**`
- `.github/workflows/supabase-production.yml`

**What It Does**:

#### Migration Deployment
1. **Tracks Applied Migrations**: Uses git tags to track deployment history
2. **Identifies New Migrations**: Compares against last deployment tag
3. **Applies Changes Sequentially**: Runs migrations in chronological order
4. **Validates Success**: Verifies migration was recorded in database
5. **Creates Deployment Tag**: Tags commit with `supabase-migrations-YYYYMMDD-HHMMSS`

**Migration Application Logic**:
```bash
# First deployment: Apply all migrations
find supabase/migrations -name "*.sql" | sort

# Subsequent deployments: Apply only new migrations
git diff --name-only $LAST_DEPLOYED_TAG HEAD | \
  grep '^supabase/migrations/.*\.sql$' | sort
```

**Connection Method**:
- Uses Supavisor Session Mode (port 5432) for IPv4 compatibility
- Format: `postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres`
- Ensures GitHub Actions runners can connect reliably

#### Edge Function Deployment
1. **Detects Function Changes**: Identifies modified `.ts` files in `supabase/functions/`
2. **Deploys All Functions**: Runs `supabase functions deploy` to production
3. **Automatic Branch Sharing**: Functions automatically work in all branches (main + development-v2)

**Deployment Summary**:
```markdown
## 🚀 Supabase Production Deployment

- **Migrations**: ✅ Deployed (3 migrations)
- **Edge Functions**: ✅ Deployed (fathom-sync, fathom-webhook)
- **Commit**: `abc123def456`
- **Deployed by**: @username
```

**Error Handling**:
- **Migration Failure**: Deployment stops, rollback required
- **Function Failure**: Continues with warning, retries available
- **Connection Failure**: Automatic retry with exponential backoff

---

### 3️⃣ Weekly Data Synchronization (`supabase-sync-data.yml`)

**Trigger**:
- **Automatic**: Every Sunday at 2 AM UTC (cron: `0 2 * * 0`)
- **Manual**: Via GitHub Actions "Run workflow" button

**What It Does**:

#### Step 1: Locate Development Branch
```yaml
- Find branch named "development-v2"
- If not found, create it automatically
- Extract branch ID for connection
```

#### Step 2: Get Connection Details
```yaml
- Query Supabase API for branch connection string
- Extract database name from POSTGRES_URL_NON_POOLING
- Build Supavisor-compatible connection URL
```

#### Step 3: Export Production Data
```bash
pg_dump "$PRODUCTION_DB_URL" \
  --no-owner \
  --no-privileges \
  --schema=public \
  -Fc \
  -f production_dump.sql
```

**Why These Flags**:
- `--no-owner`: Prevents ownership conflicts
- `--no-privileges`: Prevents privilege conflicts
- `--schema=public`: Only sync application data (not auth/storage)
- `-Fc`: Custom format for better compression

#### Step 4: Restore to Development Branch
```bash
# Drop conflicting FK constraints
ALTER TABLE meeting_action_items DROP CONSTRAINT IF EXISTS meeting_action_items_task_id_fkey CASCADE;
ALTER TABLE next_action_suggestions DROP CONSTRAINT IF EXISTS next_action_suggestions_created_task_id_fkey CASCADE;

# Restore data
pg_restore \
  --dbname="$DEV_DB_URL" \
  --no-owner \
  --no-privileges \
  --data-only \
  --disable-triggers \
  production_dump.sql

# Restore FK constraints
ALTER TABLE meeting_action_items ADD CONSTRAINT meeting_action_items_task_id_fkey ...;
ALTER TABLE next_action_suggestions ADD CONSTRAINT next_action_suggestions_created_task_id_fkey ...;
```

**Why These Flags**:
- `--data-only`: Branch already has schema from migrations
- `--disable-triggers`: Prevents trigger conflicts during load
- FK constraint management: Prevents foreign key violations

#### Step 5: Verification
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

**Sync Summary**:
```markdown
## 🔄 Production → Development Data Sync

- **Source**: Production Database
- **Target**: Development Branch (`17b178b9-bb9b-4ccd-a125-5e49398bb989`)
- **Dump Size**: 45.2 MB
- **Status**: ✅ Completed
- **Sync Time**: 2025-12-03 02:00:00 UTC
```

---

## Technical Implementation Details

### IPv4 Compatibility Solution

**Problem**: GitHub Actions runners don't support IPv6, but Supabase default connections use IPv6.

**Solution**: Supabase Supavisor Connection Pooler
```bash
# Direct connection (IPv6 - doesn't work in GitHub Actions)
postgres://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres

# Supavisor Session Mode (IPv4 - works everywhere)
postgres://postgres.PROJECT_REF:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Port Modes**:
- **Port 5432**: Session Mode (one connection per client, better for migrations)
- **Port 6543**: Transaction Mode (connection pooling, better for high-throughput)

### Foreign Key Constraint Management

**Challenge**: Circular foreign key dependencies prevent data restoration.

**Solution**: Temporary constraint removal
```sql
-- Before restore: Drop problematic constraints
ALTER TABLE meeting_action_items
  DROP CONSTRAINT IF EXISTS meeting_action_items_task_id_fkey CASCADE;

-- Restore data with triggers disabled
pg_restore --disable-triggers ...

-- After restore: Recreate constraints
ALTER TABLE meeting_action_items
  ADD CONSTRAINT meeting_action_items_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
```

### Protected Auth Tables

**Challenge**: Cannot drop functions with triggers on `auth.users` table.

**Solution**: Data-only restoration
```bash
# ❌ BAD: Tries to drop/recreate schema (fails on auth triggers)
pg_restore --clean production_dump.sql

# ✅ GOOD: Only restores data (schema comes from migrations)
pg_restore --data-only production_dump.sql
```

### Migration History Tracking

**Challenge**: Know which migrations have been applied to production.

**Solution**: Git tags + commit tracking
```bash
# Create tag after successful deployment
git tag -a "supabase-migrations-20251203-120000" \
  -m "Supabase migrations deployed to production"

# Find last deployment
LAST_DEPLOYED=$(git log --format="%H" -n 1 --grep="supabase-migrations-deployed")

# Get new migrations since then
git diff --name-only $LAST_DEPLOYED HEAD | \
  grep '^supabase/migrations/.*\.sql$'
```

---

## Configuration Requirements

### GitHub Secrets

Required secrets in GitHub repository settings:

```yaml
SUPABASE_PROJECT_ID: "ewtuefzeogytgmsnkpmb"
SUPABASE_ACCESS_TOKEN: "sbp_..."  # From Supabase dashboard
SUPABASE_DB_PASSWORD: "..."       # Production database password
PRODUCTION_DB_URL: "postgres://postgres.ewtuefzeogytgmsnkpmb:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

**How to Get These**:
1. **Project ID**: Supabase dashboard → Settings → General
2. **Access Token**: Supabase dashboard → Settings → Access Tokens → Create new token
3. **DB Password**: Supabase dashboard → Settings → Database → Password
4. **Production URL**: Construct using project ID + password + Supavisor pooler

### Environment Configuration

**Production Environment** (main branch):
```yaml
protection_rules:
  required_reviewers: 1
  restrict_who_can_deploy: true
  environment_secrets:
    - SUPABASE_PROJECT_ID
    - SUPABASE_DB_PASSWORD
    - PRODUCTION_DB_URL
```

---

## Usage Guide

### Creating New Migrations

**Always use Supabase CLI** to generate migrations:
```bash
# ✅ CORRECT: Auto-generates timestamp
supabase migration new add_customer_table

# ❌ WRONG: Manual timestamp (prone to errors)
touch supabase/migrations/20251203000000_add_customer_table.sql
```

**Migration Template**:
```sql
-- Migration: Add customer table
-- Created: 2025-12-03
-- Description: Creates customer table with basic fields

BEGIN;

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_customers_email ON public.customers(email);

-- Add RLS policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer records"
  ON public.customers FOR SELECT
  USING (auth.uid() = id);

COMMIT;
```

### Deploying Changes

**Standard Workflow**:
```bash
# 1. Create feature branch
git checkout -b feature/add-customer-table

# 2. Create migration
supabase migration new add_customer_table

# 3. Edit migration file
nano supabase/migrations/[timestamp]_add_customer_table.sql

# 4. Test locally (optional but recommended)
supabase db reset  # Applies all migrations fresh
supabase db diff   # Shows changes vs remote

# 5. Commit and push
git add supabase/migrations/
git commit -m "Add customer table migration"
git push origin feature/add-customer-table

# 6. Create Pull Request on GitHub
# ✅ PR validation runs automatically

# 7. After approval, merge to main
# ✅ Automatic deployment to production
# ✅ Edge functions deploy if changed
# ✅ Git tag created for deployment history
```

### Manual Data Sync Trigger

**Via GitHub UI**:
1. Go to: https://github.com/[your-org]/[your-repo]/actions
2. Select: "Sync Production Data to Development"
3. Click: "Run workflow"
4. Select branch: `main`
5. Click: "Run workflow" button

**Expected Duration**: 2-5 minutes (depending on data size)

### Rollback Procedure

**If migration fails in production**:

```bash
# 1. Find the failing migration
git log --oneline --grep="supabase-migrations-deployed" | head -5

# 2. Create rollback migration
supabase migration new rollback_customer_table

# 3. Write rollback SQL
# File: supabase/migrations/[timestamp]_rollback_customer_table.sql
BEGIN;
DROP TABLE IF EXISTS public.customers CASCADE;
COMMIT;

# 4. Deploy through normal PR process
git add supabase/migrations/
git commit -m "Rollback customer table migration"
git push origin main
```

**Important**: Never modify the `supabase_migrations.schema_migrations` table manually!

---

## Monitoring & Troubleshooting

### Success Indicators

**PR Validation**:
- ✅ PR has automated comment with migration summary
- ✅ All checks pass (green checkmark)
- ✅ No warnings about dangerous operations

**Production Deployment**:
- ✅ Workflow completes without errors
- ✅ Git tag created: `supabase-migrations-YYYYMMDD-HHMMSS`
- ✅ Deployment summary shows "✅ Deployed"

**Data Sync**:
- ✅ Workflow completes in 2-5 minutes
- ✅ Summary shows data dump size
- ✅ Verification query returns table counts

### Common Issues

#### Issue: PR Validation Fails on Naming Convention
```
❌ Migration file add_table.sql does not match naming convention
```

**Solution**:
```bash
# Use CLI to generate properly named file
supabase migration new add_table
```

#### Issue: Production Deployment Fails on Migration
```
❌ Migration failed: 20251203_add_table.sql
ERROR: relation "old_table" does not exist
```

**Solution**:
1. Check migration depends on previous migration
2. Ensure all dependencies are included
3. Test locally with `supabase db reset`
4. Create rollback migration if needed

#### Issue: Data Sync Fails on FK Constraints
```
ERROR: insert or update on table violates foreign key constraint
```

**Solution**: The workflow automatically handles this, but if it fails:
1. Check `.github/workflows/supabase-sync-data.yml` lines 154-158
2. Ensure FK constraints are dropped before restore
3. Verify constraints are recreated after restore

#### Issue: IPv6 Connection Timeout
```
ERROR: could not translate host name to address
```

**Solution**: Ensure using Supavisor pooler URL:
```bash
# ❌ WRONG: Direct IPv6 connection
postgres://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

# ✅ RIGHT: Supavisor IPv4 pooler
postgres://postgres.PROJECT:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

---

## Performance & Scale

### Current Metrics
- **Migration Deploy Time**: < 2 minutes
- **Edge Function Deploy Time**: < 1 minute
- **Data Sync Time**: 2-5 minutes (depends on data size)
- **Total Automation**: 100% (zero manual steps)

### Scalability Considerations

**Database Size Impact**:
- **< 100 MB**: 2-3 minute sync time
- **100 MB - 1 GB**: 5-10 minute sync time
- **> 1 GB**: Consider incremental sync strategy

**Migration Complexity**:
- **Simple DDL**: < 10 seconds
- **Data Migrations**: Varies by table size
- **Complex Transformations**: May need batching

**Recommendations for Large Datasets**:
1. Use `--jobs` flag for parallel pg_dump/restore
2. Implement incremental sync (only changed data)
3. Consider compression for network transfer
4. Schedule syncs during low-traffic periods

---

## Future Enhancements

### Planned Improvements
1. **Incremental Data Sync**: Only sync changed records
2. **Migration Testing in PR**: Spin up ephemeral database for testing
3. **Automatic Rollback**: Detect failures and auto-rollback
4. **Performance Monitoring**: Track migration execution time
5. **Slack Notifications**: Alert on deployment success/failure

### Enhancement Proposals

**Migration Testing** (High Priority):
```yaml
# Add to supabase-pr.yml
- name: Test migrations in ephemeral database
  run: |
    # Spin up test database
    supabase start

    # Apply migrations
    supabase db push

    # Run test suite
    npm run test:migrations

    # Cleanup
    supabase stop
```

**Incremental Sync** (Medium Priority):
```bash
# Only sync modified data
pg_dump --data-only --table=users --table=deals \
  | psql $DEV_DB_URL
```

---

## Support & Maintenance

### Key Files
- **Workflows**: `.github/workflows/supabase-*.yml`
- **Migrations**: `supabase/migrations/*.sql`
- **Functions**: `supabase/functions/*/index.ts`
- **Config**: `supabase/config.toml`

### Maintenance Tasks

**Weekly**:
- ✅ Review data sync logs
- ✅ Check deployment summaries
- ✅ Monitor error rates

**Monthly**:
- ✅ Review migration history
- ✅ Clean up old git tags
- ✅ Update Supabase CLI version

**Quarterly**:
- ✅ Audit GitHub secrets rotation
- ✅ Review workflow efficiency
- ✅ Update documentation

### Contact & Resources

**Documentation**:
- Supabase CLI: https://supabase.com/docs/guides/cli
- GitHub Actions: https://docs.github.com/en/actions
- PostgreSQL: https://www.postgresql.org/docs/

**Support Channels**:
- Supabase Discord: https://discord.supabase.com
- GitHub Issues: [Your repo]/issues

---

## Appendix

### Workflow File Reference

**Complete Workflow Files**:
1. `.github/workflows/supabase-pr.yml` - PR validation (136 lines)
2. `.github/workflows/supabase-production.yml` - Production deployment (190 lines)
3. `.github/workflows/supabase-sync-data.yml` - Data synchronization (225 lines)

**Total Automation Coverage**: 551 lines of YAML ensuring:
- ✅ Pre-merge validation
- ✅ Automatic production deployment
- ✅ Weekly data synchronization
- ✅ Complete audit trail
- ✅ Zero manual intervention

### Glossary

- **Migration**: SQL file that modifies database schema
- **Edge Function**: Serverless function running in Supabase
- **RLS**: Row Level Security (Supabase access control)
- **Supavisor**: Supabase's connection pooler (IPv4/IPv6 compatibility)
- **Preview Branch**: Isolated database environment for testing
- **Schema Drift**: Differences between code and database schema
- **Deployment Tag**: Git tag marking successful production deployment

---

**Document Status**: ✅ Complete and Verified
**Last Deployment**: 2025-12-03
**Pipeline Status**: ✅ Fully Operational
**Next Sync**: Sunday, 2025-12-08 @ 02:00 UTC
