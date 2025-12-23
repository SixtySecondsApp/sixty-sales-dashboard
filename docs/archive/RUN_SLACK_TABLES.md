# How to Create Slack Tables in Supabase

## Option 1: Via Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor:**
   - Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
   - You'll need to log in with your Supabase account

2. **Run the SQL Script:**
   - Copy ALL the contents from `fix_slack_tables.sql`
   - Paste it into the SQL Editor
   - Click the "Run" button (or press Ctrl/Cmd + Enter)

3. **Verify Tables Were Created:**
   After running, execute this verification query:
   ```sql
   -- Check if tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('slack_integrations', 'slack_channels');
   ```

## Option 2: Via Supabase CLI (If Dashboard Access Issues)

If you're having authentication issues with the dashboard, use the CLI:

```bash
# First, ensure you're logged in to Supabase CLI
npx supabase login

# Then run the SQL directly
npx supabase db execute --file fix_slack_tables.sql
```

## Option 3: Via Direct Database Connection

If you have direct database credentials:

```bash
# Using psql (if you have PostgreSQL client installed)
psql "postgresql://postgres:[your-password]@db.ewtuefzeogytgmsnkpmb.supabase.co:5432/postgres" -f fix_slack_tables.sql
```

## Troubleshooting the 401 Error

The "Missing authorization header" error typically means:

1. **Not logged in to Supabase Dashboard** - Make sure you're logged in at https://app.supabase.com

2. **Browser session expired** - Try:
   - Clear browser cache/cookies for supabase.com
   - Log out and log back in
   - Use an incognito/private window

3. **API Key Issues** - If accessing via API:
   - Ensure you're using the service role key for admin operations
   - Check that the key is properly set in environment variables

## After Tables Are Created

Once the tables are successfully created, test the Slack integration:

1. Go to https://sales.sixtyseconds.video/workflows
2. Click "Connect Slack"
3. Authorize the app
4. You should be redirected back successfully

## Quick Test Query

Run this in the SQL Editor to confirm everything is set up:

```sql
-- This should return empty results but no errors
SELECT * FROM slack_integrations LIMIT 1;
SELECT * FROM slack_channels LIMIT 1;

-- Check RLS policies are in place
SELECT COUNT(*) as policy_count 
FROM pg_policies 
WHERE tablename IN ('slack_integrations', 'slack_channels');
-- Should return 10 (5 policies per table)
```