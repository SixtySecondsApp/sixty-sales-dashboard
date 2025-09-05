# Complete Slack OAuth Setup Guide

## Current Status
You're receiving a 401 "Missing authorization header" error. This guide will help you complete the setup.

## Step 1: Create Database Tables (REQUIRED)

The Slack tables don't exist yet in your database. You MUST create them first.

### Option A: Via Supabase Dashboard (Easiest)
1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new
2. Log in with your Supabase account
3. Copy ALL contents from `fix_slack_tables.sql` file
4. Paste into the SQL Editor
5. Click "Run" button

### Option B: Via Supabase CLI
```bash
npx supabase db execute --file fix_slack_tables.sql
```

### Verify Tables Were Created
Run this query in SQL Editor to confirm:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('slack_integrations', 'slack_channels');
```
You should see both tables listed.

## Step 2: Verify Edge Function Environment Variables

The environment variables have been set via CLI. To verify in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/settings/functions
2. Check that these secrets are set:
   - `SLACK_CLIENT_ID` = 417685783159.9470252829718
   - `SLACK_CLIENT_SECRET` = 9e6f8536988d2d250c772277e4d87083
   - `PUBLIC_URL` = https://sales.sixtyseconds.video

## Step 3: Check Edge Function Logs

To see what's happening with the OAuth callback:

1. Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/slack-oauth-callback
2. Click on "Logs" tab
3. Look for recent entries when you try to connect Slack
4. Check for these log messages:
   - `[Slack OAuth] Request method: GET`
   - `[Slack OAuth] Client ID configured: yes/no`
   - `[Slack OAuth] Client Secret configured: yes/no`

## Step 4: Test the Complete Flow

1. **Clear any cached state:**
   - Clear browser cookies for sales.sixtyseconds.video
   - Use an incognito window if needed

2. **Start fresh OAuth flow:**
   - Go to: https://sales.sixtyseconds.video/workflows
   - Click "Connect Slack" button
   - Authorize the app in Slack
   - Watch for the redirect back

3. **If successful:**
   - You'll be redirected to `/workflows?slack_connected=true`
   - Slack channels will appear in the dropdown

4. **If it fails:**
   - Check the URL parameters for error messages
   - Review Edge Function logs for specific errors

## Step 5: Common Issues and Solutions

### Issue: 401 "Missing authorization header"
**Cause:** Edge Function is being called directly without proper setup
**Solution:** Complete Steps 1-2 above

### Issue: "Database error: [object Object]"
**Cause:** Tables don't exist in database
**Solution:** Run the SQL script in Step 1

### Issue: 404 on slack_integrations table
**Cause:** Tables haven't been created
**Solution:** Run the SQL script in Step 1

### Issue: "Invalid client_id parameter" from Slack
**Cause:** Environment variables not set
**Solution:** Check Step 2 and redeploy function

## Step 6: Manual Testing

If automated flow isn't working, test components individually:

### Test Database Tables:
```sql
-- Insert a test record (will fail if table doesn't exist)
INSERT INTO slack_integrations (
  user_id, 
  team_id, 
  team_name, 
  access_token, 
  bot_user_id, 
  app_id, 
  scope
) VALUES (
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
  'TEST123',
  'Test Team',
  'xoxb-test-token',
  'U123456',
  'A123456',
  'chat:write'
);

-- Then delete it
DELETE FROM slack_integrations WHERE team_id = 'TEST123';
```

### Test Edge Function Directly:
```bash
curl https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/slack-oauth-callback?code=test
```
This should return an error but confirm the function is deployed.

## Step 7: Next Steps After Setup

Once everything is working:

1. **Test sending a message:**
   - Create a workflow with Slack notification
   - Trigger the workflow
   - Check Slack for the message

2. **Monitor for issues:**
   - Keep Edge Function logs open
   - Watch for any database errors
   - Check Slack app installation status

## Need Help?

1. **Check logs:** Edge Function logs will show detailed error messages
2. **Verify database:** Ensure tables exist and have proper permissions
3. **Test environment:** Try in incognito mode to rule out caching issues
4. **Slack app settings:** Verify OAuth redirect URL in Slack app configuration matches:
   `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/slack-oauth-callback`

## Files Reference

- `fix_slack_tables.sql` - SQL script to create necessary tables
- `supabase/functions/slack-oauth-callback/index.ts` - OAuth callback handler
- `src/lib/services/slackOAuthService.ts` - Frontend OAuth service
- `src/components/SlackConnectionButton.tsx` - UI component for connection