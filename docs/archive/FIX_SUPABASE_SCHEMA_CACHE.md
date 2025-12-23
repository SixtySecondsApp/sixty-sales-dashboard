# Fix Supabase Schema Cache for registration_url Column

## Problem
The `registration_url` column exists in the database and works with direct SQL inserts, but Supabase PostgREST API inserts are ignoring it (returning NULL).

## Solution: Refresh Supabase Schema Cache

Supabase PostgREST caches the database schema. When you add a new column, you need to refresh the cache.

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Look for **"Reload Schema"** or **"Refresh Schema"** button
4. Click it to refresh PostgREST's schema cache

### Option 2: Via Supabase CLI
```bash
supabase db reset --linked
```

### Option 3: Restart PostgREST (if you have access)
If you're self-hosting Supabase, restart the PostgREST service.

### Option 4: Wait for Auto-Refresh
Supabase automatically refreshes the schema cache periodically (usually within a few minutes), but manual refresh is faster.

## Verify It's Working

After refreshing the schema cache:

1. **Test with a new signup** - The registration URL should now be saved
2. **Check the console logs** - You should see `entryRegistrationUrl: '/waitlist'` in the insert result
3. **Query the database** - The `registration_url` column should have values

## If It Still Doesn't Work

If refreshing the schema cache doesn't work, check:

1. **RLS Policies** - Make sure the insert policy allows the `registration_url` field
2. **Column Permissions** - Verify the column is accessible to the `anon` role
3. **Check the insert response** - Look at the console logs to see what Supabase actually returns


