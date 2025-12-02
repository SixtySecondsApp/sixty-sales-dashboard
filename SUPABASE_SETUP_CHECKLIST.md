# Supabase Branching Setup Checklist

Use this checklist to ensure all setup steps are completed correctly.

## Prerequisites

- [ ] Supabase Pro plan or higher (required for branching)
- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] PostgreSQL client tools installed (`pg_dump`, `pg_restore`)
- [ ] GitHub repository with Actions enabled
- [ ] Admin access to Supabase Dashboard

## Initial Setup Steps

### 1. Link Local Project

- [ ] Run: `supabase login`
- [ ] Run: `supabase link --project-ref <your-project-id>`
- [ ] Verify `.supabase/` folder was created

### 2. Create Development Branch

- [ ] Run: `supabase branches create development --persistent --project-ref <project-id>`
- [ ] Note the branch ID from the output
- [ ] Verify branch appears in: `supabase branches list`

### 3. Get Connection Details

- [ ] Run: `supabase branches get <branch-id> --project-ref <project-id>`
- [ ] Copy the database URL
- [ ] Copy the API URL (for VITE_SUPABASE_URL)
- [ ] Copy the anon key (for VITE_SUPABASE_ANON_KEY)

### 4. Configure GitHub Secrets

Go to: GitHub Repo → Settings → Secrets and variables → Actions

- [ ] `SUPABASE_ACCESS_TOKEN` - From Supabase Dashboard → Account → Access Tokens
- [ ] `SUPABASE_PROJECT_ID` - From Supabase Dashboard → Project Settings → General
- [ ] `SUPABASE_DB_PASSWORD` - From Supabase Dashboard → Project Settings → Database
- [ ] `PRODUCTION_DB_URL` - Format: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`
- [ ] `DEVELOPMENT_BRANCH_ID` - From `supabase branches list` output (optional, workflow can find it)

### 5. Configure Local Environment

- [ ] Create `.env.development` file (copy from `.env.development.example` if it exists)
- [ ] Set `VITE_SUPABASE_URL` to Development branch URL
- [ ] Set `VITE_SUPABASE_ANON_KEY` to Development branch anon key
- [ ] Set `DEVELOPMENT_DB_URL` for sync script
- [ ] Set `PRODUCTION_DB_URL` for sync script
- [ ] Verify `.env.development` is in `.gitignore`

### 6. Test Local Connection

- [ ] Update your app to use `.env.development` values
- [ ] Start local dev server
- [ ] Verify connection to Development branch works
- [ ] Test a database query to confirm connectivity

### 7. Test Workflows

#### PR Validation Workflow

- [ ] Create a test feature branch: `git checkout -b test/supabase-setup`
- [ ] Create a test migration file: `supabase migration new test_migration`
- [ ] Add a simple SQL statement (e.g., `SELECT 1;`)
- [ ] Commit and push: `git push origin test/supabase-setup`
- [ ] Create a PR to `main`
- [ ] Verify PR validation workflow runs successfully
- [ ] Check PR comment shows migration summary

#### Production Deploy Workflow

- [ ] Merge the test PR to `main`
- [ ] Verify production deploy workflow runs
- [ ] Check that migrations are applied to Production
- [ ] Verify deployment tag is created

#### Data Sync Workflow

- [ ] Go to Actions → "Sync Production Data to Development"
- [ ] Click "Run workflow" → "Run workflow"
- [ ] Verify workflow completes successfully
- [ ] Check Development branch has fresh data

### 8. Verify Configuration Files

- [ ] `.github/workflows/supabase-pr.yml` exists
- [ ] `.github/workflows/supabase-production.yml` exists
- [ ] `.github/workflows/supabase-sync-data.yml` exists
- [ ] `scripts/sync-prod-to-dev.sh` exists and is executable
- [ ] `supabase/config.toml` has branching configuration
- [ ] `SUPABASE_BRANCHING_SETUP.md` documentation exists

### 9. Team Communication

- [ ] Share setup documentation with team
- [ ] Update team wiki/docs with new workflow
- [ ] Inform team about Development branch usage
- [ ] Set up notifications for workflow failures (optional)

### 10. Schedule Configuration

- [ ] Review sync schedule in `supabase-sync-data.yml`
- [ ] Adjust cron schedule if needed (default: weekly Sunday 2 AM UTC)
- [ ] Consider team's working hours for sync timing

## Post-Setup Verification

After completing all steps:

- [ ] Local development connects to Development branch ✅
- [ ] PRs validate migrations without applying them ✅
- [ ] Merges to main deploy migrations to Production ✅
- [ ] Data sync runs on schedule ✅
- [ ] Manual data sync works via script ✅

## Troubleshooting

If any step fails:

1. Check `SUPABASE_BRANCHING_SETUP.md` for detailed instructions
2. Review GitHub Actions logs for error details
3. Verify all secrets are set correctly
4. Check Supabase Dashboard for branch status
5. Ensure CLI tools are up to date: `supabase update`

## Next Steps

Once setup is complete:

1. Start using Development branch for all local work
2. Create migrations as needed for new features
3. Use PR workflow for migration validation
4. Let automated workflows handle Production deploys
5. Monitor sync schedule to ensure data stays fresh

## Support Resources

- Setup Guide: `SUPABASE_BRANCHING_SETUP.md`
- Quick Reference: `.github/SUPABASE_WORKFLOW_QUICK_REF.md`
- Supabase Docs: https://supabase.com/docs/guides/cli/local-development#branching

