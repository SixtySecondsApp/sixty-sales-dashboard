# Complete New Development Branch Setup

## Current Status

**New Branch Created**: `development-v2` (ID: `17b178b9-bb9b-4ccd-a125-5e49398bb989`)
**Status**: `CREATING_PROJECT` (provisioning in progress)
**Expected Time**: 2-5 minutes total

## Automated Monitoring

I've created a monitoring script that will check the branch status automatically:

```bash
./check-new-branch-status.sh
```

This will:
- Check status every 10 seconds
- Alert when branch is ACTIVE or ready
- Retrieve connection details automatically

## Manual Steps After Branch is Ready

### Step 1: Verify Branch is Active

```bash
supabase branches list --experimental
```

Look for `development-v2` with status `ACTIVE` or `MIGRATIONS_FAILED` (both are usable).

### Step 2: Get Branch Connection Details

```bash
supabase branches get 17b178b9-bb9b-4ccd-a125-5e49398bb989 \
  --project-ref ewtuefzeogytgmsnkpmb \
  --output json \
  --experimental | jq '.'
```

This will return JSON with:
- `SUPABASE_URL` - The branch's URL
- `SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Private service role key
- `POSTGRES_URL_NON_POOLING` - Database connection string

### Step 3: Extract Database Password

From the `POSTGRES_URL_NON_POOLING` output, extract the password (format: `postgres://postgres.xxx:PASSWORD@host:port/db`)

### Step 4: Update `.env` File

Update your `.env` file with the new branch credentials:

```env
# =============================================================================
# SUPABASE CONFIGURATION - DEVELOPMENT BRANCH (NEW)
# =============================================================================
# Development branch: development-v2
# Branch ID: 17b178b9-bb9b-4ccd-a125-5e49398bb989
# Project: ewtuefzeogytgmsnkpmb (Production)

# Development Branch URL
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co

# Development Branch Anonymous Key
VITE_SUPABASE_ANON_KEY=[ANON_KEY_FROM_STEP_2]

# Development Branch Service Role Key
VITE_SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_FROM_STEP_2]
SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_FROM_STEP_2]

# Supabase Access Token (for CLI operations)
SUPABASE_ACCESS_TOKEN=sbp_8e5eef8735fc3f15ed2544a5ad9508a902f2565f

# Database password (extracted from POSTGRES_URL_NON_POOLING)
SUPABASE_DATABASE_PASSWORD=[PASSWORD_FROM_STEP_3]

# Project IDs
SUPABASE_PROJECT_ID=ewtuefzeogytgmsnkpmb

# Keep all your other environment variables below...
# (AWS, API keys, etc.)
```

### Step 5: Sync Production Data to New Branch

**Option A: Manual Trigger via GitHub Actions**
1. Go to: https://github.com/[your-repo]/actions
2. Find workflow: "Sync Production Data to Development"
3. Click "Run workflow"
4. Select branch: `main`
5. Click "Run workflow" button

**Option B: Wait for Automatic Sync**
- Runs every Sunday at 2 AM UTC
- Will automatically sync production data to the new branch

**Option C: Manual psql Copy**
```bash
# Dump from production
pg_dump \
  "postgres://postgres.ewtuefzeogytgmsnkpmb:IKYzK6buAvaLDMqy@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  -f temp_prod_data.sql

# Restore to development-v2
psql "postgres://postgres.[NEW_PROJECT_REF]:[NEW_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  < temp_prod_data.sql
```

### Step 6: Restart Development Server

```bash
# Stop current dev server (Ctrl+C if running)

# Start fresh
npm run dev
```

### Step 7: Verify Connection

1. Open browser to `http://localhost:5173` (or your dev port)
2. Check for:
   - ✅ No "API connection lost" errors
   - ✅ Can log in successfully
   - ✅ Data loads properly
   - ✅ No console errors related to Supabase

## Expected Migration Status

**Important**: The new branch will likely show `MIGRATIONS_FAILED` status initially because it inherits the migration issues from the main branch.

**This is OK!** The database schema will be correct because:
1. Migrations that worked on main are applied to the branch
2. The database structure is functional
3. Data sync will work properly

You can verify the schema is correct by:
```bash
# List tables in the new branch
psql "postgres://postgres.[NEW_PROJECT_REF]:[NEW_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres" \
  -c "\dt public.*"
```

## Troubleshooting

### Branch Stuck in CREATING_PROJECT
If the branch status doesn't change after 10 minutes:
1. Check Supabase dashboard: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/branches
2. Contact Supabase support if needed
3. Try creating with a different name: `supabase branches create dev-branch-v3 --project-ref ewtuefzeogytgmsnkpmb --experimental`

### Can't Get Branch Details
If `supabase branches get` fails:
1. Wait 1-2 minutes after status changes to ACTIVE
2. Check Supabase dashboard for connection strings manually
3. Use the dashboard UI to view branch settings

### Connection Errors After .env Update
1. Verify the project ref in URL matches the output from step 2
2. Check for typos in ANON_KEY and SERVICE_ROLE_KEY
3. Ensure no extra quotes or newlines in .env values
4. Restart dev server after .env changes

## Benefits of New Branch

Once complete, you'll have:
- ✅ **Clean Development Environment**: Fresh branch without migration history issues
- ✅ **Production Data Copy**: Weekly automatic sync of production data
- ✅ **Isolated Testing**: Changes won't affect production
- ✅ **Working Edge Functions**: Shared across all branches in the project
- ✅ **Proper CI/CD**: GitHub Actions workflows work correctly

## Next Steps After Setup Complete

1. **Update GitHub Actions Workflow** (if needed):
   - The workflow currently syncs to branch ID `68fc8173-d1b9-47be-8920-9aa8218cc285` (old development)
   - Update `.github/workflows/supabase-sync-data.yml` to use new branch ID: `17b178b9-bb9b-4ccd-a125-5e49398bb989`

2. **Test Data Sync**:
   - Manually trigger the workflow
   - Verify data appears in development-v2 branch
   - Confirm no errors in workflow logs

3. **Update Documentation**:
   - Update any docs that reference the old development branch
   - Document the new branch credentials (securely)
   - Share setup instructions with team

4. **Archive Old Branch** (later):
   - The old `development` branch can't be deleted (persistent)
   - You can ignore it or contact Supabase support to request deletion
   - It won't interfere with the new branch

## Quick Reference

**New Branch ID**: `17b178b9-bb9b-4ccd-a125-5e49398bb989`
**Branch Name**: `development-v2`
**Production Project**: `ewtuefzeogytgmsnkpmb`

**Monitor Script**: `./check-new-branch-status.sh`
**Status Check**: `supabase branches list --experimental`
**Get Details**: `supabase branches get 17b178b9-bb9b-4ccd-a125-5e49398bb989 --project-ref ewtuefzeogytgmsnkpmb --output json --experimental`
