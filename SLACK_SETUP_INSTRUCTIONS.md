# Slack Integration Setup Instructions

## Step 1: Create Slack Tables in Supabase

1. Go to your Supabase project dashboard: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb
2. Click on "SQL Editor" in the left sidebar
3. Copy and paste the entire contents of `fix_slack_tables.sql` into the SQL editor
4. Click "Run" to execute the SQL

This will:
- Create the `slack_integrations` table for storing OAuth tokens
- Create the `slack_channels` table for caching channel information
- Set up proper RLS (Row Level Security) policies
- Add necessary indexes for performance
- Grant permissions for authenticated users and service role

## Step 2: Deploy the Updated Edge Function

Run the following command to deploy the Edge Function with the fixed error handling:

```bash
npx supabase functions deploy slack-oauth-callback
```

## Step 3: Test the Integration

1. Go to https://sales.sixtyseconds.video/workflows
2. Click "Connect Slack" button
3. Authorize the app in Slack
4. You should be redirected back with a success message
5. The Slack channels should now appear in the workflow dropdown

## Troubleshooting

If you still see errors:

1. **Check if tables were created:**
   - In Supabase SQL Editor, run:
   ```sql
   SELECT * FROM slack_integrations;
   SELECT * FROM slack_channels;
   ```

2. **Check RLS policies:**
   - Go to Authentication > Policies in Supabase
   - Verify that both tables have RLS enabled with the correct policies

3. **Check Edge Function logs:**
   - Go to Functions in Supabase
   - Click on `slack-oauth-callback`
   - View the logs for any errors

4. **Environment Variables:**
   - Verify in your Edge Function settings that these are set:
     - `SLACK_CLIENT_ID`
     - `SLACK_CLIENT_SECRET`
     - `PUBLIC_URL`

## Manual SQL Verification

To verify the tables exist and have proper structure, run this query:

```sql
-- Check table structure
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('slack_integrations', 'slack_channels')
ORDER BY table_name, ordinal_position;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('slack_integrations', 'slack_channels');
```

## Next Steps

Once the tables are created and the Edge Function is deployed:
1. The Slack integration should work properly
2. OAuth tokens will be stored securely in the database
3. Channels will be cached for quick access
4. The workflow system can send messages to selected Slack channels