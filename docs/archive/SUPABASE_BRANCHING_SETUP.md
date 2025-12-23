# Supabase Branching Setup Guide

This guide explains how to set up Supabase branching with a persistent Development branch and automated CI/CD workflows.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE PROJECT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Production (main)              Development Branch             │
│   ┌──────────────┐              ┌──────────────┐               │
│   │  Live Data   │  ──────────► │  Cloned Data │  (scheduled)  │
│   │  Schema v1.2 │              │  Schema v1.2 │               │
│   └──────────────┘              └──────────────┘               │
│          ▲                             ▲                        │
│          │                             │                        │
│   PR Merge to main              Local Development               │
│   (migrations only)             (always connects here)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Supabase Pro plan or higher (required for branching)
- Supabase CLI installed: `npm install -g supabase`
- PostgreSQL client tools installed (`pg_dump`, `pg_restore`)
- GitHub repository with Actions enabled

## Initial Setup

### 1. Link Your Local Project to Supabase

```bash
# Login to Supabase
supabase login

# Link to your project (get project ID from Supabase dashboard)
supabase link --project-ref <your-project-id>
```

### 2. Create Persistent Development Branch

```bash
# Create a persistent development branch
supabase branches create development --persistent --project-ref <your-project-id>
```

**Note**: The `--persistent` flag ensures the branch won't be auto-deleted. This is your permanent development environment.

### 3. Get Development Branch Connection Details

```bash
# List all branches to find your development branch ID
supabase branches list --project-ref <your-project-id>

# Get connection details for the development branch
supabase branches get <development-branch-id> --project-ref <your-project-id>
```

### 4. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token | Supabase Dashboard → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | Your project reference ID | Supabase Dashboard → Project Settings → General |
| `SUPABASE_DB_PASSWORD` | Production database password | Supabase Dashboard → Project Settings → Database |
| `PRODUCTION_DB_URL` | Production connection string | Format: `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` |
| `DEVELOPMENT_BRANCH_ID` | Development branch ID | From `supabase branches list` output |

### 5. Configure Local Environment

Create a `.env.development` file (or update your existing `.env.local`):

```env
# Development Branch Connection
VITE_SUPABASE_URL=https://<project-ref>-<branch-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<development-branch-anon-key>

# Database URLs (for sync script)
PRODUCTION_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
DEVELOPMENT_DB_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<branch-id>.pooler.supabase.com:6543/postgres

# Project Configuration
SUPABASE_PROJECT_ID=<your-project-ref-id>
SUPABASE_ACCESS_TOKEN=<your-access-token>
DEVELOPMENT_BRANCH_ID=<development-branch-id>
```

**Important**: Your local development should always connect to the Development branch, not Production!

## Workflow

### Daily Development

1. **Work on feature branch locally**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Create migrations as needed**
   ```bash
   # Create a new migration
   supabase migration new add_new_table
   
   # Edit the migration file in supabase/migrations/
   ```

3. **Test migrations locally**
   ```bash
   # Push migrations to development branch
   supabase db push --db-url "$DEVELOPMENT_DB_URL"
   ```

4. **Create PR**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

### PR Workflow

When you create a PR:

1. **PR Validation** (`.github/workflows/supabase-pr.yml`)
   - Automatically validates migration files
   - Checks naming conventions
   - Comments on PR with migration summary
   - **No actual database changes**

### Merge to Main

When PR is merged to `main`:

1. **Production Deploy** (`.github/workflows/supabase-production.yml`)
   - Automatically applies migrations to Production
   - Deploys edge functions to Production
   - Creates deployment tag

### Scheduled Data Sync

Every week (configurable):

1. **Data Sync** (`.github/workflows/supabase-sync-data.yml`)
   - Exports production data
   - Restores to Development branch
   - Keeps development data fresh

## Manual Data Sync

To manually sync production data to development:

### Option 1: Using GitHub Actions

1. Go to Actions → "Sync Production Data to Development"
2. Click "Run workflow"
3. Select "Force refresh" if needed
4. Click "Run workflow"

### Option 2: Using Local Script

```bash
# Make script executable
chmod +x scripts/sync-prod-to-dev.sh

# Set environment variables
export SUPABASE_PROJECT_ID=<your-project-id>
export SUPABASE_ACCESS_TOKEN=<your-token>
export PRODUCTION_DB_URL=<production-url>
export DEVELOPMENT_DB_URL=<development-url>

# Run sync
./scripts/sync-prod-to-dev.sh
```

## Configuration Files

### GitHub Actions Workflows

- **`.github/workflows/supabase-pr.yml`**: Validates migrations on PR
- **`.github/workflows/supabase-production.yml`**: Deploys to Production on merge
- **`.github/workflows/supabase-sync-data.yml`**: Scheduled data sync

### Scripts

- **`scripts/sync-prod-to-dev.sh`**: Manual data sync script

## Adjusting Sync Schedule

To change when data sync runs, edit `.github/workflows/supabase-sync-data.yml`:

```yaml
on:
  schedule:
    # Daily at 2 AM UTC
    - cron: '0 2 * * *'
    
    # Weekly on Sunday at 2 AM UTC
    # - cron: '0 2 * * 0'
```

## Troubleshooting

### Migration Validation Fails

- Check migration file naming: `YYYYMMDDHHMMSS_description.sql`
- Ensure SQL syntax is valid
- Check for common issues (DROP CASCADE, DELETE statements)

### Data Sync Fails

- Verify database connection strings are correct
- Check that Development branch exists and is accessible
- Ensure `pg_dump` and `pg_restore` are installed
- Check GitHub Actions logs for detailed error messages

### Local Development Can't Connect

- Verify `.env.development` has correct Development branch URL
- Check that Development branch is active (not paused)
- Ensure you're using the Development branch anon key, not Production

### Edge Functions Not Deploying

- Verify Supabase CLI is authenticated
- Check that function files are in `supabase/functions/`
- Review GitHub Actions logs for deployment errors

## Security Notes

- **Never commit** `.env.development` or `.env.local` files
- Production data contains real user data - handle with care
- Development branch should have same RLS policies as Production
- Consider data sanitization if sharing Development branch access

## Cost Considerations

- Preview branches are billed per hour of compute
- Development branch (persistent) is always running = always billing
- Branches auto-pause after inactivity (configurable)
- Monitor usage in Supabase Dashboard → Billing

## Next Steps

1. Complete the Initial Setup steps above
2. Test the PR workflow by creating a test PR
3. Verify Production deploy works by merging a test PR
4. Wait for or manually trigger the data sync to verify it works
5. Update your team documentation with this workflow

## Support

For issues or questions:
- Check Supabase Branching docs: https://supabase.com/docs/guides/cli/local-development#branching
- Review GitHub Actions logs for detailed error messages
- Check Supabase Dashboard for branch status

