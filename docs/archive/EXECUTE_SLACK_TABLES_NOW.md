# 🚨 EXECUTE THIS IMMEDIATELY TO FIX SLACK INTEGRATION

## The 406 and 400 errors you're seeing are because the Slack tables don't exist in your database yet.

### Step 1: Create Tables (REQUIRED)
1. Go to: **https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new**
2. Copy the ENTIRE content from `supabase/migrations/20250905203303_create_slack_integration_tables.sql`
3. Paste it in the SQL Editor
4. Click **"Run"**

### Step 2: Verify Tables Were Created
Run this query to check:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('slack_integrations', 'slack_channels') 
AND table_schema = 'public';
```

You should see both tables listed.

### Step 3: Test Integration
1. Go to: https://sales.sixtyseconds.video/workflows  
2. Click "Connect Slack" button
3. You should now see the success notification and connected status

### Current Status:
- ✅ OAuth callback function deployed and working
- ✅ Edge Functions configured with proper secrets
- ✅ Frontend code ready with blocks support
- ❌ **Database tables missing (causing 406 error)**

### After Creating Tables:
- The 406 error will be resolved
- Slack connection will work properly
- Channel selection will be available
- Message sending will work (including blocks)

### What the SQL Script Creates:
- `slack_integrations` table for OAuth tokens
- `slack_channels` table for channel caching
- Proper RLS policies for security
- Indexes for performance
- Triggers for timestamp updates
- Permissions for authenticated users and service role

**This is the only step preventing your Slack integration from working!**