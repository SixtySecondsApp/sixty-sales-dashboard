# Quick Dashboard SQL Fix

Since the GitHub Actions workflow ran successfully but PostgREST cache hasn't updated, we need to manually trigger a schema reload.

## Solution: Run SQL in Dashboard

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/jczngsvpywgrlgdwzjbr

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Run This SQL**
   ```sql
   -- Verify tables exist
   SELECT
     schemaname,
     tablename
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename;

   -- If tables show up, force PostgREST reload by making a DDL change
   COMMENT ON TABLE profiles IS 'User profiles - PostgREST cache refresh';

   -- Wait 30 seconds, then check if this works
   SELECT COUNT(*) as profile_count FROM profiles;
   ```

4. **What You Should See**
   - First query: Should show ~80+ tables including profiles, deals, contacts, etc.
   - Second query: Adds a comment (forces cache reload)
   - Third query: If it returns a count, PostgREST cache has refreshed!

5. **If Tables Don't Exist**
   Then the GitHub Actions workflow didn't actually apply the migrations. In that case:

   a. Check the workflow logs in GitHub Actions
   b. Look for errors in the "Apply Migrations" step
   c. Let me know what error you see

6. **If Tables Exist But Query Fails**
   Wait 2-3 minutes for PostgREST to detect the schema change, then run:
   ```bash
   node sync-data-via-api.mjs
   ```

## Expected Timeline

- SQL Editor verification: 30 seconds
- PostgREST cache refresh: 1-2 minutes
- Data sync: 2-3 minutes
- **Total: 4-6 minutes**

## Next Steps

After running the SQL above:
1. If you see tables → Wait 2 minutes → Run `node sync-data-via-api.mjs`
2. If no tables → Check GitHub Actions logs for errors
