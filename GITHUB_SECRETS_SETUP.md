# GitHub Secrets Setup for CI/CD Pipeline

This document lists all the GitHub repository secrets required for the Supabase CI/CD workflows.

## Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

### Core Supabase Secrets

| Secret Name | Description | Where to Find |
|-------------|-------------|---------------|
| `SUPABASE_PROJECT_ID` | Your Supabase project reference ID | Supabase Dashboard → Project Settings → General → Reference ID (e.g., `ewtuefzeogytgmsnkpmb`) |
| `SUPABASE_ACCESS_TOKEN` | Personal access token for Supabase CLI | [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens) → Generate new token |
| `SUPABASE_DB_PASSWORD` | Database password | Supabase Dashboard → Project Settings → Database → Database password |

### Optional Secrets (for specific workflows)

| Secret Name | Description | Used By |
|-------------|-------------|---------|
| `CRON_SECRET` | Secret for cron job authentication | `scheduled-jobs.yml` |
| `SUPABASE_URL` | Full Supabase URL | `scheduled-jobs.yml` (for edge function calls) |
| `SLACK_WEBHOOK_URL` | Slack notifications | `memory-optimized-deploy.yml` |

## Setup Steps

### 1. Get Supabase Project ID

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Project Settings** → **General**
4. Copy the **Reference ID** (e.g., `ewtuefzeogytgmsnkpmb`)
5. Add as `SUPABASE_PROJECT_ID` in GitHub Secrets

### 2. Generate Supabase Access Token

1. Go to [Supabase Access Tokens](https://supabase.com/dashboard/account/tokens)
2. Click **Generate new token**
3. Give it a name (e.g., "GitHub Actions CI/CD")
4. Copy the token (you won't see it again!)
5. Add as `SUPABASE_ACCESS_TOKEN` in GitHub Secrets

### 3. Get Database Password

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Project Settings** → **Database**
4. Under "Connection string", click "Reset database password" if you don't know it
5. Copy the password
6. Add as `SUPABASE_DB_PASSWORD` in GitHub Secrets

## Verification

After adding the secrets, verify them by running the "Sync Production Data to Development" workflow manually:

1. Go to **Actions** tab in your repository
2. Select **"Sync Production Data to Development"**
3. Click **"Run workflow"**
4. Watch the logs - it should connect successfully to both databases

## Workflow Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `supabase-pr.yml` | PR to main with migrations | Validates SQL syntax, naming conventions |
| `supabase-production.yml` | Push to main with migrations/functions | Deploys migrations and edge functions to production |
| `supabase-sync-data.yml` | Weekly (Sunday 2AM UTC) or manual | Syncs production data to development branch |
| `seed-dev-branch.yml` | Manual only | Full seed of development-v2 branch |

## Troubleshooting

### "Could not connect to database"

- Verify `SUPABASE_PROJECT_ID` is correct (just the reference ID, not the full URL)
- Verify `SUPABASE_DB_PASSWORD` is correct
- Check that your project is in `us-west-1` region (or update the workflow `SUPABASE_REGION` env variable)

### "Authentication failed"

- Verify `SUPABASE_ACCESS_TOKEN` is correct
- Make sure the token hasn't expired
- Generate a new token if needed

### "Branch not found"

- The development branch ID `17b178b9-bb9b-4ccd-a125-5e49398bb989` is hardcoded
- If you recreated the branch, update the `DEV_BRANCH_ID` in the workflows

## Region Configuration

Your Supabase project is in **West US (North California)** which is AWS region `us-west-1`.

The workflows use Supavisor Session Mode (port 5432) for IPv4 compatibility with GitHub Actions runners. The connection string format is:

```
postgres://postgres.{PROJECT_ID}:{PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

If you ever migrate to a different region, update the `SUPABASE_REGION` environment variable in each workflow file.
