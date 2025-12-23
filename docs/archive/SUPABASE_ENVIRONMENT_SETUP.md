# Supabase Environment Setup

## Overview

This project uses a **dual Supabase setup** for development and production environments:

- **Development**: Separate Supabase project (`yjdzlbivjddcumtevggd`) for local development
- **Production**: Main Supabase project (`ewtuefzeogytgmsnkpmb`) for production deployments

## Local Development Configuration

Your local environment is configured to use the **development branch** with production data:

```bash
# Development Branch Project
Project ID: yjdzlbivjddcumtevggd
URL: https://yjdzlbivjddcumtevggd.supabase.co
```

### Current Setup

✅ **Local development** → Development branch project (`yjdzlbivjddcumtevggd`)
✅ **Weekly data sync** → Production data copied to development branch
✅ **Schema updates** → Applied via migrations in GitHub Actions
✅ **Safe testing** → Real production data without affecting production

## Environment Variables

Your `.env` file is configured with:

```env
# Development Branch (Active for local development)
VITE_SUPABASE_URL=https://yjdzlbivjddcumtevggd.supabase.co
VITE_SUPABASE_ANON_KEY=<development-anon-key>
VITE_SUPABASE_SERVICE_ROLE_KEY=<development-service-role-key>
```

## Data Sync Schedule

**Production → Development Branch**
- Runs every Sunday at 2 AM UTC
- Can be manually triggered via GitHub Actions
- Syncs all production data to development branch
- Last successful sync: December 3, 2025, 09:50:21 UTC

## Development Workflow

### 1. Local Development
```bash
# Start local development server
npm run dev

# Your local app connects to: yjdzlbivjddcumtevggd
# This has production data synced weekly
```

### 2. Database Migrations
```bash
# Create a new migration
supabase migration new add_new_feature

# Edit the migration file in: supabase/migrations/
# Example: 20251203000000_add_new_feature.sql
```

### 3. Testing Migrations Locally
```bash
# Apply migration to your local development branch
supabase db push

# Or test with local Supabase instance
supabase start
supabase db reset
```

### 4. Deploying to Production
```bash
# 1. Commit your migration
git add supabase/migrations/20251203000000_add_new_feature.sql
git commit -m "Add new feature migration"

# 2. Push to feature branch
git push origin feature/add-new-feature

# 3. Create PR to main
# GitHub Actions will validate the migration

# 4. Merge PR
# GitHub Actions automatically applies migration to production
```

## CI/CD Pipeline

### PR Validation
- Validates SQL syntax
- Checks naming conventions
- Warns about dangerous operations
- Posts summary comment on PR

### Production Deployment
- Automatically deploys on merge to main
- Applies only new migrations
- Creates deployment tags
- Verifies successful application

### Data Sync
- Weekly automatic sync (Sundays 2 AM UTC)
- Manual trigger available in GitHub Actions
- Syncs production data to development branch

## Project Structure

```
📁 sixty-sales-dashboard/
├── .env                           # Environment configuration
├── supabase/
│   ├── migrations/                # Database migrations
│   │   └── 20251203000000_*.sql  # Migration files
│   └── functions/                 # Edge functions
└── .github/
    └── workflows/
        ├── supabase-pr.yml        # PR validation
        ├── supabase-production.yml # Production deployment
        └── supabase-sync-data.yml  # Data synchronization
```

## Important Notes

⚠️ **Never commit `.env` file** - It contains sensitive credentials
⚠️ **Test migrations locally first** - Before pushing to production
⚠️ **Use migration naming convention** - `YYYYMMDDHHMMSS_description.sql`
⚠️ **Production data in dev** - Development branch has real production data (synced weekly)

## Switching Between Environments

### To use Production (Not recommended for local development):
```env
# Uncomment and update in .env:
# VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
# VITE_SUPABASE_ANON_KEY=<production-anon-key>
```

### To use Development (Current setup):
```env
# Already configured in your .env:
VITE_SUPABASE_URL=https://yjdzlbivjddcumtevggd.supabase.co
VITE_SUPABASE_ANON_KEY=<development-anon-key>
```

## Troubleshooting

### Issue: "Cannot connect to Supabase"
**Solution**: Verify your `.env` file has the correct development credentials

### Issue: "Missing data in local development"
**Solution**: Wait for weekly sync or manually trigger data sync in GitHub Actions

### Issue: "Migration not applied locally"
**Solution**: Run `supabase db push` to apply pending migrations

### Issue: "Production data is outdated in dev"
**Solution**: Manually trigger the `supabase-sync-data.yml` workflow in GitHub Actions

## Getting Help

- **Supabase Dashboard**: https://app.supabase.com/project/yjdzlbivjddcumtevggd
- **GitHub Actions**: Check workflow runs for deployment status
- **Migration Issues**: Review PR validation comments
- **Data Sync Status**: Check Actions → Sync Production Data to Development

---

**Last Updated**: December 3, 2025
**Configuration Status**: ✅ Active and working
