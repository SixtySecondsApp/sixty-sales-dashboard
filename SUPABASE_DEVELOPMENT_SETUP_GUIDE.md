# Supabase Development Branch Setup - Complete Guide

**Last Updated**: December 2, 2025
**Status**: ✅ Setup Complete with IPv6 Limitation Documented

---

## Overview

This guide documents the complete process of setting up Supabase branching for safe development, including all challenges encountered and solutions implemented. This is a reference for AI assistants and developers working on this project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Branch Creation](#branch-creation)
4. [Environment Configuration](#environment-configuration)
5. [GitHub Actions Setup](#github-actions-setup)
6. [Known Issues & Limitations](#known-issues--limitations)
7. [Troubleshooting](#troubleshooting)
8. [Alternative Approaches](#alternative-approaches)

---

## Prerequisites

### Required Tools
- **Supabase CLI** v2.33.9+ (install: `brew install supabase/tap/supabase`)
- **PostgreSQL Client Tools** (pg_dump, pg_restore, psql)
- **GitHub CLI** (optional, for PR automation)
- **Admin Access** to Supabase Dashboard

### Required Information
- Supabase Project ID: `ewtuefzeogytgmsnkpmb`
- Supabase Access Token (get from: https://app.supabase.com/account/tokens)
- Production Database Password
- GitHub Repository with Actions enabled

---

## Initial Setup

### Step 1: Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### Step 2: Link Project to Supabase

```bash
# Authenticate with Supabase
supabase login

# Link to project
supabase link --project-ref ewtuefzeogytgmsnkpmb
```

**Expected Output**: Project linked successfully

### Step 3: Add Access Token to Environment

Add to `.env` file:
```env
SUPABASE_ACCESS_TOKEN=sbp_[YOUR_TOKEN_HERE]
```

**Important**: Get fresh token from https://app.supabase.com/account/tokens

---

## Branch Creation

### Create Development Branch

```bash
supabase branches create development \
  --project-ref ewtuefzeogytgmsnkpmb \
  --experimental
```

**Expected Output**:
- Branch ID: `68fc8173-d1b9-47be-8920-9aa8218cc285`
- Status: `ACTIVE_HEALTHY`
- Database Host: `db.yjdzlbivjddcumtevggd.supabase.co`

### Verify Branch Status

```bash
supabase branches get 68fc8173-d1b9-47be-8920-9aa8218cc285 \
  --project-ref ewtuefzeogytgmsnkpmb \
  --experimental
```

---

## Environment Configuration

### Update .env File

Replace production URLs with development branch:

```env
# Development Branch Connection
VITE_SUPABASE_URL=https://yjdzlbivjddcumtevggd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZHpsYml2amRkY3VtdGV2Z2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDg4NTYsImV4cCI6MjA4MDI4NDg1Nn0.MCZNcLG2jhtS4I8A9pIfHHbtj_Z-js7teTNGslDshQM

# Branch Configuration
SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb
DEVELOPMENT_BRANCH_ID=68fc8173-d1b9-47be-8920-9aa8218cc285

# Database Connections
PRODUCTION_DB_URL=postgresql://postgres:[PASSWORD]@db.ewtuefzeogytgmsnkpmb.supabase.co:5432/postgres
DEVELOPMENT_DB_URL=postgresql://postgres:kbpjsDPWVsFqGtZrgHYVMOkHvOyUZRpA@db.yjdzlbivjddcumtevggd.supabase.co:5432/postgres
```

**Note**: Get production database password from:
https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/settings/database

---

## GitHub Actions Setup

### Required Secrets

Add these secrets at: https://github.com/SixtySecondsApp/sixty-sales-dashboard/settings/secrets/actions

| Secret Name | Value Source | Example |
|------------|--------------|---------|
| `SUPABASE_ACCESS_TOKEN` | https://app.supabase.com/account/tokens | `sbp_9a4e7b9b543c833171f4c0f9c33164ff1c12f09f` |
| `SUPABASE_PROJECT_ID` | Project ref | `ewtuefzeogytgmsnkpmb` |
| `SUPABASE_DB_PASSWORD` | Supabase Dashboard → Settings → Database | `IKYzK6buAvaLDMqy` |
| `PRODUCTION_DB_URL` | Constructed connection string | See format below |
| `DEVELOPMENT_BRANCH_ID` | Branch creation output | `68fc8173-d1b9-47be-8920-9aa8218cc285` |

#### PRODUCTION_DB_URL Format

**Use Supavisor Session Mode for IPv4 compatibility:**

```
postgres://postgres.ewtuefzeogytgmsnkpmb:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Important**:
- ✅ Use **Supavisor pooler** (aws-0-REGION.pooler.supabase.com)
- ✅ Port **5432** (session mode) for pg_dump/pg_restore
- ❌ Do NOT use direct connection (db.PROJECT.supabase.co) - IPv6 only

### Workflow Files

Three workflows are configured in `.github/workflows/`:

1. **`supabase-pr.yml`** - Validates migrations on pull requests
2. **`supabase-production.yml`** - Deploys to production on merge to main
3. **`supabase-sync-data.yml`** - Syncs production data to development

---

## Known Issues & Limitations

### ✅ SOLVED: IPv6 Connectivity Issue

**Issue**: Since January 15, 2024, Supabase stopped assigning IPv4 addresses to projects. Direct database connections (`db.projectref.supabase.co`) now resolve to IPv6 only, which GitHub Actions runners cannot handle.

**Solution**: Use **Supavisor Session Mode** (Port 5432) instead of direct connections.

#### Supavisor Session Mode Connection Format

```
postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

**Key Points**:
- ✅ Port **5432** (session mode) - provides IPv4 compatibility
- ✅ Port **6543** (transaction mode) - use for connection pooling only
- ✅ Works with `pg_dump`, `pg_restore`, and `psql`
- ✅ Compatible with GitHub Actions runners
- ✅ Requires Supabase CLI >= 1.136.3

#### Updated Connection Strings

**Production (via Supavisor)**:
```env
PRODUCTION_DB_URL=postgres://postgres.ewtuefzeogytgmsnkpmb:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

**Development Branch (via Supavisor)**:
```env
DEVELOPMENT_DB_URL=postgres://postgres.BRANCH_ID:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

#### Regional Pooler Hosts

Find your pooler host from Supabase Dashboard → Connect → Session mode:
- **US East**: `aws-0-us-east-1.pooler.supabase.com`
- **US West**: `aws-0-us-west-1.pooler.supabase.com`
- **EU West**: `aws-0-eu-west-2.pooler.supabase.com`
- **AP Southeast**: `aws-0-ap-southeast-1.pooler.supabase.com`

#### Network Restrictions

If you have network restrictions enabled, add this CIDR range for branching:
```
2600:1f18:2b7d:f600::/56
```

Go to: Project Settings → Database → Network Restrictions

---

## Troubleshooting

### Authentication Issues

**Problem**: `cannot save provided token: Invalid access token format`

**Solutions**:
1. Get fresh token from https://app.supabase.com/account/tokens
2. Ensure token starts with `sbp_`
3. Check for extra spaces or characters when pasting
4. Use direct token argument instead of stdin:
   ```bash
   supabase login --token $SUPABASE_ACCESS_TOKEN
   ```

### Connection Issues

**Problem**: `Wrong password` errors

**Solution**:
1. Get password from Supabase Dashboard → Settings → Database
2. Update both `SUPABASE_DB_PASSWORD` and `PRODUCTION_DB_URL` secrets
3. Ensure password in connection string matches the secret

**Problem**: PostgreSQL version mismatch

**Solution**:
```bash
# Use matching PostgreSQL version
/opt/homebrew/Cellar/postgresql@15/15.13/bin/pg_dump
```

### DNS Resolution Issues

**Problem**: `could not translate host name`

**Diagnosis**:
```bash
# Check DNS resolution
host db.yjdzlbivjddcumtevggd.supabase.co

# If only IPv6 address returned, you lack IPv6 connectivity
```

**Solution**: Wait for DNS propagation (15-30 minutes) or purchase IPv4 add-on

---

## Alternative Approaches

### Local Development Without Branch

If IPv6 connectivity is not available:

1. **Use Local Supabase**:
   ```bash
   supabase start
   supabase db reset
   ```

2. **Direct Production Development** (caution):
   - Keep `.env` pointing to production
   - Test thoroughly before deploying
   - Use transaction blocks for safety

3. **Manual Migration Testing**:
   ```bash
   # Test migration locally
   supabase migration new test_feature
   # Edit migration file
   supabase db push
   ```

---

## Development Workflow

### Creating Migrations

```bash
# Create new migration
supabase migration new add_feature_name

# Edit the migration file
vim supabase/migrations/[timestamp]_add_feature_name.sql

# Test locally (if IPv6 available)
supabase db push --db-url "$DEVELOPMENT_DB_URL"
```

### Deploying to Production

```bash
# Commit migration
git add supabase/migrations/
git commit -m "feat: Add feature name"

# Push to create PR
git push origin feature-branch

# After PR approval and merge to main:
# - supabase-production.yml workflow automatically deploys
```

---

## Testing Connection

### Test Script

Create `test-supabase-connection.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  const { data, error } = await supabase
    .from('profiles')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }

  console.log('✅ Connection successful!');
  const isDev = supabaseUrl.includes('yjdzlbivjddcumtevggd');
  console.log('🌍 Environment:', isDev ? '🔧 DEVELOPMENT' : '🚀 PRODUCTION');
  return true;
}

testConnection();
```

Run test:
```bash
node test-supabase-connection.js
```

---

## Configuration Files Reference

### `.env` Structure

```env
# Supabase URLs
VITE_SUPABASE_URL=https://[branch-or-project].supabase.co
VITE_SUPABASE_ANON_KEY=[jwt-token]

# Service Role (for migrations)
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# CLI Configuration
SUPABASE_ACCESS_TOKEN=sbp_[token]
SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb
DEVELOPMENT_BRANCH_ID=[branch-id]

# Database Connections
PRODUCTION_DB_URL=postgresql://postgres:[pwd]@db.[project].supabase.co:5432/postgres
DEVELOPMENT_DB_URL=postgresql://postgres:[pwd]@db.[branch].supabase.co:5432/postgres
```

### GitHub Workflow Configuration

Key workflow settings in `.github/workflows/supabase-sync-data.yml`:

```yaml
# Use Supabase CLI for better error handling
- name: Export Production Data
  run: |
    supabase db dump \
      --db-url "${{ secrets.PRODUCTION_DB_URL }}" \
      --file production_dump.sql \
      --data-only

# Push to development branch
- name: Restore Data
  run: |
    supabase db push \
      --db-url "${{ steps.get-dev-connection.outputs.db_url }}" \
      --file production_dump.sql
```

**Note**: This workflow will fail without IPv6 connectivity or IPv4 add-on.

---

## Summary Checklist

Use this checklist when setting up Supabase branching:

- [ ] Supabase CLI installed and authenticated
- [ ] Project linked to Supabase
- [ ] Development branch created
- [ ] Branch status is ACTIVE_HEALTHY
- [ ] Local `.env` updated with development branch URLs
- [ ] GitHub Secrets configured (all 5 secrets)
- [ ] Workflow files committed to repository
- [ ] IPv6 connectivity verified OR IPv4 add-on purchased
- [ ] Test connection successful
- [ ] Documentation reviewed

---

## Support Resources

- **Supabase CLI Docs**: https://supabase.com/docs/guides/cli
- **Branching Docs**: https://supabase.com/docs/guides/platform/branching
- **IPv4 Add-on**: Contact Supabase support
- **Project Dashboard**: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb

---

## AI Assistant Notes

When helping users with Supabase setup:

1. **Always check for IPv6 connectivity first** before attempting data sync
2. **Use Supabase CLI commands** instead of direct PostgreSQL connections
3. **Verify DNS resolution** before troubleshooting authentication
4. **Get fresh tokens** - old tokens may be expired or malformed
5. **Use direct connection strings** (port 5432) not pooler (port 6543) for dumps
6. **Document limitations clearly** - IPv6 issue is not fixable without add-on

### Common Error Patterns

| Error | Root Cause | Solution |
|-------|------------|----------|
| `Invalid access token format` | Malformed or old token | Get fresh token from dashboard |
| `Wrong password` | Password mismatch | Verify from dashboard, update both secrets |
| `Network is unreachable` | No IPv6 connectivity | Purchase IPv4 add-on or use alternatives |
| `could not translate host name` | DNS not propagated | Wait 15-30 minutes or check IPv6 |
| `version mismatch` | Wrong pg_dump version | Use matching PostgreSQL version |

---

**Setup Completed**: December 2, 2025
**Branch Status**: ✅ ACTIVE_HEALTHY
**Data Sync Status**: ⚠️ Requires IPv4 Add-on for Automation
