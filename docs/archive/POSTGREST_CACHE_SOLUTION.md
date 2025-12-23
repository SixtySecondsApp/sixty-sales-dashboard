# PostgREST Schema Cache Issue - Solution

## The Problem

All the columns have been added to the database successfully (you can verify this by running the verification queries in `force-postgrest-reload.sql`), but PostgREST's API layer has cached the old schema and won't recognize the new columns.

This is why you're seeing errors like:
- `Could not find the 'engagement_level' column of 'contacts' in the schema cache`
- `Could not find the 'close_date' column of 'deals' in the schema cache`
- `Could not find the 'is_rebooking' column of 'activities' in the schema cache`

## Solutions (Try in Order)

### Solution 1: Wait for Automatic Cache Expiry (10 minutes)

PostgREST automatically refreshes its schema cache every 10 minutes. Simply:

1. Wait 10 minutes after running `FINAL_SCHEMA_FIX.sql`
2. Run `node sync-data-via-api.mjs` again

**Timeline**: 10 minutes wait + 3-5 minutes sync = 13-15 minutes total

### Solution 2: Force PostgREST Reload via SQL

Run `force-postgrest-reload.sql` in the Supabase dashboard:

```sql
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE profiles IS 'User profiles - force cache reload';
COMMENT ON TABLE contacts IS 'Contacts - force cache reload';
COMMENT ON TABLE deals IS 'Deals - force cache reload';
COMMENT ON TABLE activities IS 'Activities - force cache reload';
COMMENT ON TABLE meetings IS 'Meetings - force cache reload';
COMMENT ON TABLE communication_events IS 'Communication events - force cache reload';
```

Then wait 2-3 minutes and retry the sync.

### Solution 3: Restart PostgREST Service

In Supabase dashboard:

1. Go to **Project Settings** → **Database**
2. Look for **"Restart services"** or **"Restart PostgREST"** button
3. Click to restart the API service
4. Wait 2-3 minutes
5. Run `node sync-data-via-api.mjs`

### Solution 4: Verify Columns Exist (Debugging)

If the above don't work, verify the columns were actually added:

```sql
-- Check contacts table has engagement_level
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contacts'
AND column_name = 'engagement_level';

-- Check deals table has close_date
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deals'
AND column_name = 'close_date';

-- Check activities table has is_rebooking
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'activities'
AND column_name = 'is_rebooking';
```

If any of these return `0 rows`, then the `FINAL_SCHEMA_FIX.sql` didn't actually add the columns. In that case, re-run it.

## Why This Happens

Supabase uses PostgREST to expose your PostgreSQL database as a REST API. PostgREST caches the database schema for performance. When you add columns via SQL, the database is updated immediately, but PostgREST's cache doesn't know about the changes until:

1. The cache timeout expires (default: 10 minutes)
2. PostgREST receives a NOTIFY signal
3. PostgREST detects a DDL change (COMMENT ON TABLE)
4. The service is manually restarted

## Recommended Approach

**Most Reliable**: Just wait 10 minutes after running `FINAL_SCHEMA_FIX.sql`, then run the sync.

This guarantees the cache will have expired and PostgREST will see all the new columns.

## Expected Timeline

- Run `FINAL_SCHEMA_FIX.sql`: 1 minute
- Wait for cache expiry: 10 minutes
- Run `node sync-data-via-api.mjs`: 3-5 minutes
- **Total: 14-16 minutes**

## How to Know When It's Working

When PostgREST cache has refreshed, the sync will complete successfully and you'll see:

```
✅ profiles: 20 records
✅ organizations: 10 records
✅ contacts: 1840 records (not 0!)
✅ deals: 652 records (not 0!)
✅ activities: 6841 records (not 0!)
✅ meetings: 1564 records (not 0!)
✅ communication_events: 16 records (not 0!)
✅ workflow_executions: 9 records (not 0!)
```

All tables will show actual record counts, not zeros.

## If Nothing Works

Contact Supabase support and ask them to:
1. Manually restart PostgREST for project `jczngsvpywgrlgdwzjbr`
2. Confirm the schema cache has been cleared

Or use their dashboard to manually trigger a service restart if that option is available.
