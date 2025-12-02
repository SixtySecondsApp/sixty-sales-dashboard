# Supabase Workflow Quick Reference

## Workflow Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `supabase-pr.yml` | PR opened/updated | Validates migrations, no DB changes |
| `supabase-production.yml` | Merge to `main` | Deploys migrations & functions to Production |
| `supabase-sync-data.yml` | Weekly schedule + manual | Syncs Production data → Development branch |

## Common Tasks

### Create a New Migration

```bash
# Create migration file
supabase migration new add_new_feature

# Edit the file in supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql

# Test locally against Development branch
supabase db push --db-url "$DEVELOPMENT_DB_URL"

# Commit and push
git add supabase/migrations/
git commit -m "Add migration for new feature"
git push origin feature/my-feature
```

### Manually Sync Production Data to Development

**Via GitHub Actions:**
1. Go to Actions tab
2. Select "Sync Production Data to Development"
3. Click "Run workflow" → "Run workflow"

**Via Local Script:**
```bash
export SUPABASE_PROJECT_ID=<project-id>
export SUPABASE_ACCESS_TOKEN=<token>
export PRODUCTION_DB_URL=<prod-url>
export DEVELOPMENT_DB_URL=<dev-url>
./scripts/sync-prod-to-dev.sh
```

### Check Migration Status

```bash
# Check Production migrations
supabase migration list --db-url "$PRODUCTION_DB_URL"

# Check Development migrations
supabase migration list --db-url "$DEVELOPMENT_DB_URL"
```

### Deploy Edge Functions Manually

```bash
# Deploy all functions to Production
supabase functions deploy --project-ref <project-id>

# Deploy specific function
supabase functions deploy function-name --project-ref <project-id>
```

## Troubleshooting

### PR Validation Fails

**Issue**: Migration validation error in PR

**Fix**:
- Check migration file naming: `YYYYMMDDHHMMSS_description.sql`
- Verify SQL syntax is correct
- Review PR comment for specific errors

### Production Deploy Fails

**Issue**: Migrations fail to deploy to Production

**Fix**:
- Check GitHub Actions logs for error details
- Verify `PRODUCTION_DB_URL` secret is correct
- Ensure migrations don't conflict with existing schema
- Check if migration was already applied

### Data Sync Fails

**Issue**: Production → Development sync fails

**Fix**:
- Verify all GitHub secrets are set correctly
- Check Development branch exists and is active
- Ensure `pg_dump`/`pg_restore` tools are available
- Review sync workflow logs for connection errors

### Local Can't Connect to Development

**Issue**: Local app can't connect to Development branch

**Fix**:
- Verify `.env.development` has correct Development branch URL
- Check Development branch is not paused
- Ensure you're using Development branch anon key (not Production)
- Test connection: `psql "$DEVELOPMENT_DB_URL"`

## Required GitHub Secrets

Ensure these are set in Settings → Secrets → Actions:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `PRODUCTION_DB_URL`
- `DEVELOPMENT_BRANCH_ID` (optional, workflow can find it)

## Workflow Status Checks

Check workflow status:
- PR validation: Look for ✅ checkmark on PR
- Production deploy: Check Actions tab after merge
- Data sync: Check Actions tab for scheduled runs

## Emergency Procedures

### Rollback a Migration

```bash
# Create a rollback migration
supabase migration new rollback_feature_name

# In the migration file, reverse the changes
# Then deploy normally via PR → merge workflow
```

### Force Data Sync

```bash
# Via GitHub Actions UI:
# Actions → Sync Production Data to Development → Run workflow → Force refresh

# Or via local script:
./scripts/sync-prod-to-dev.sh
```

### Pause Development Branch

```bash
# Pause to save costs
supabase branches pause <branch-id> --project-ref <project-id>

# Resume when needed
supabase branches resume <branch-id> --project-ref <project-id>
```

