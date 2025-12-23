# Production to Development-v2 Data Sync Fix Guide

## Problem Summary

When syncing production data to development-v2 Supabase preview branch:
1. ✅ Data was synced successfully (10,952 records)
2. ✅ Auth users were created via `create-users-cli.mjs`
3. ❌ Auth users got **NEW UUIDs** (Supabase doesn't allow specifying user IDs)
4. ❌ All foreign keys still point to **OLD production profile IDs**
5. ❌ Result: Orphaned records (activities, deals, contacts not linked to users)

## Solution Overview

Map foreign keys from OLD production profile IDs → NEW development-v2 auth user IDs using **email** as the matching key.

## Step-by-Step Fix Process

### Step 1: Get Production Auth User Mappings

**Option A: Using SQL (Recommended)**

Run this on your **PRODUCTION** database:

```bash
# Connect to production via Supabase SQL Editor or psql
psql "postgresql://postgres.ewtuefzeogytgmsnkpmb:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
```

Then run:
```sql
SELECT
    email,
    id as prod_auth_id
FROM auth.users
ORDER BY email;
```

Copy the output and format it as INSERT statements (see Step 2).

**Option B: Using Node.js Script**

If you have production service role key, update `get-production-auth-ids.mjs` with correct credentials and run:
```bash
node get-production-auth-ids.mjs
```

### Step 2: Apply the Fix

1. Open `ULTIMATE-FIX.sql`
2. Find the section that says:
   ```sql
   -- INSERT YOUR PRODUCTION AUTH USER MAPPINGS HERE
   ```
3. Paste your production auth user mappings in this format:
   ```sql
   INSERT INTO prod_auth_users (email, prod_auth_id) VALUES
   ('[email protected]', '00000000-0000-0000-0000-000000000001'),
   ('[email protected]', '00000000-0000-0000-0000-000000000002'),
   ('[email protected]', '00000000-0000-0000-0000-000000000003');
   ```
4. Run the complete `ULTIMATE-FIX.sql` script on **development-v2**

### Step 3: Verify the Fix

After running the script, check the orphaned counts:

```sql
SELECT
    'activities' as table_name,
    COUNT(*) as total,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.id
UNION ALL
SELECT 'deals', COUNT(*), SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END)
FROM deals d LEFT JOIN profiles p ON d.owner_id = p.id
UNION ALL
SELECT 'contacts', COUNT(*), SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END)
FROM contacts c LEFT JOIN profiles p ON c.owner_id = p.id;
```

**Expected result**: All orphaned counts should be 0 (or very close to 0).

## What the Fix Does

The `ULTIMATE-FIX.sql` script:

1. **Adds `user_id` column** to activities table (needed by frontend)
2. **Creates mapping table**: OLD production auth IDs → NEW development-v2 auth IDs (via email)
3. **Updates all foreign keys** in these tables:
   - `contacts.owner_id`
   - `deals.owner_id`
   - `activities.owner_id` AND `activities.user_id`
   - `meetings.owner_user_id`
   - `communication_events.user_id`
   - `workflow_executions.user_id`
   - `tasks.assigned_to` AND `tasks.created_by`
4. **Verifies** orphaned record counts
5. **Reports** total updates made

## Current Status

**Production (main branch)**:
- 20 profiles
- 20 auth.users
- 0 orphaned records ✅

**Development-v2**:
- 6,841 activities (1,802 orphaned) ❌
- 652 deals (209 orphaned) ❌
- 1,840 contacts (1,113 orphaned) ❌

## Files Created

1. **`ULTIMATE-FIX.sql`** - Main fix script (needs production auth mappings)
2. **`get-production-mappings.sql`** - Helper query for production
3. **`check-profile-situation.sql`** - Diagnostic queries
4. **`diagnose-mapping-issue.sql`** - Additional diagnostics
5. **`SYNC_FIX_GUIDE.md`** - This guide

## Why Previous Attempts Failed

The `FIX-EVERYTHING.sql` script had this flawed logic:

```sql
-- This tried to find profiles with same email but different IDs
-- within the SAME profiles table
CREATE TEMP TABLE profile_id_mapping AS
SELECT old_p.id as old_id, new_p.id as new_id
FROM profiles old_p
INNER JOIN profiles new_p ON old_p.email = new_p.email
WHERE old_p.id != new_p.id;
```

**Problem**: The OLD production profile IDs aren't in the profiles table anymore - they only exist as orphaned foreign keys in activities/deals/contacts.

**Solution**: Map from production auth.users IDs (obtained via Step 1) to development-v2 auth.users IDs (via email matching).

## Next Steps

1. ✅ Get production auth user mappings (Step 1)
2. ✅ Insert mappings into ULTIMATE-FIX.sql (Step 2)
3. ⏳ Run ULTIMATE-FIX.sql on development-v2
4. ⏳ Verify orphaned counts are 0
5. ✅ Log in and confirm data is properly linked

## Troubleshooting

**If orphaned counts are still high after running the fix:**

1. Run `check-profile-situation.sql` to see current state
2. Verify production auth mappings were inserted correctly
3. Check if email addresses match between production and development-v2
4. Look for any typos or formatting issues in the INSERT statements

**If you get permission errors:**

Make sure you're running the script with appropriate privileges (as postgres superuser or database owner).

**If foreign key constraint violations occur:**

The script updates records to point to existing auth user IDs, so this shouldn't happen. If it does, it means the email→auth_id mapping is incorrect.

## Important Notes

- The frontend uses `activities.user_id` (not `owner_id`) so both columns need to be updated
- Production auth IDs != Development-v2 auth IDs (even for same email)
- Always verify orphaned counts before and after running the fix
- This is a one-time fix - future syncs will need similar remapping
