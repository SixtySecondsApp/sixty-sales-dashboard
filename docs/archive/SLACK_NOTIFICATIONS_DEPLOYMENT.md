# 🚀 Slack Notifications Deployment Guide

## Overview

This guide walks you through deploying Slack notifications for meeting tasks.

**What You're Deploying**:
- Slack integration database table
- Edge function to send Slack messages
- Database trigger to call edge function
- Settings UI for users to configure Slack

---

## ✅ Prerequisites

Before deploying, ensure you have:

1. **Supabase CLI** installed
2. **Supabase project** initialized locally
3. **Database access** to your Supabase project
4. **Slack workspace** with admin permissions (to create webhooks)

---

## 📦 Deployment Steps

### Step 1: Deploy Database Migration

Deploy the Slack integration table and trigger:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Push the migration to Supabase
npx supabase db push
```

**What this does**:
- Creates `slack_integrations` table
- Adds RLS policies for user data security
- Creates `notify_slack_for_task_notification()` function
- Creates trigger on `task_notifications` table
- Adds performance indexes

**Verify migration**:
```bash
# Check if table exists
npx supabase db execute --sql "SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'slack_integrations'
);"
```

Expected output: `true`

### Step 2: Enable pg_net Extension (Required)

The Slack notification trigger uses `pg_net` to make HTTP requests:

```bash
npx supabase db execute --sql "CREATE EXTENSION IF NOT EXISTS pg_net;"
```

**Verify extension**:
```bash
npx supabase db execute --sql "SELECT * FROM pg_extension WHERE extname = 'pg_net';"
```

### Step 3: Configure Database Settings

Set Supabase URL and service role key in database:

```bash
# Get your Supabase URL and service role key from .env or Supabase dashboard
# Then run these commands (replace with your actual values):

npx supabase db execute --sql "ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ewtuefzeogytgmsnkpmb.supabase.co';"

npx supabase db execute --sql "ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';"
```

**IMPORTANT**:
- Replace `your-service-role-key-here` with your actual service role key
- Find it in: Supabase Dashboard → Settings → API → service_role key
- Keep this key secret - it has full database access

### Step 4: Deploy Edge Function

Deploy the Slack notification edge function:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Deploy the function
npx supabase functions deploy send-slack-task-notification --no-verify-jwt
```

**Verify deployment**:
```bash
# Test the function is accessible
curl https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/send-slack-task-notification \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: Error about missing parameters (means function is deployed)

### Step 5: Set Environment Variables for Edge Function

Configure the edge function with your app URL:

```bash
# Set APP_URL environment variable
npx supabase secrets set APP_URL=http://localhost:5173

# For production, use your production URL:
# npx supabase secrets set APP_URL=https://your-domain.com
```

**Verify secrets**:
```bash
npx supabase secrets list
```

You should see: `APP_URL`

### Step 6: Add Slack Settings to Frontend

Update your Settings page to include the Slack integration UI.

**File**: `src/pages/Settings.tsx`

Add this import:
```typescript
import { SlackIntegrationSettings } from '@/components/settings/SlackIntegrationSettings';
```

Add this section in the settings page (in the integrations tab):
```typescript
<div className="space-y-6">
  <h2 className="text-2xl font-semibold">Integrations</h2>

  {/* Existing integrations */}

  {/* Add Slack Integration */}
  <SlackIntegrationSettings />
</div>
```

---

## 🧪 Testing

### Test 1: Slack Webhook Setup

1. **Create Slack Webhook**:
   - Go to: https://api.slack.com/messaging/webhooks
   - Click "Create your Slack app"
   - Select workspace
   - Enable "Incoming Webhooks"
   - Click "Add New Webhook to Workspace"
   - Select channel (e.g., #sales-notifications)
   - Copy the webhook URL

2. **Configure in CRM**:
   - Navigate to Settings → Integrations
   - Find "Slack Notifications" section
   - Paste webhook URL
   - Enable notifications
   - Enable "Meeting Task Notifications"
   - Click "Save Integration"

3. **Send Test Notification**:
   - Click "Send Test" button
   - Check your Slack channel

**Expected Result**: You should see a test message in Slack with rich formatting

### Test 2: Real Meeting Task Notification

1. **Record a Fathom Meeting**:
   - Record a short 2-minute test meeting
   - Mention some action items like:
     - "We need to follow up with John next week"
     - "Send proposal to the client"
     - "Schedule demo for Friday"

2. **Wait for Sync**:
   - Wait 5-10 minutes for Fathom transcription
   - Webhook will trigger automatically
   - AI will analyze transcript

3. **Check Notifications**:
   - **In-App**: You should see toast notification
   - **Slack**: You should see Slack message with:
     - Meeting title
     - Number of tasks available
     - "View Meeting & Tasks" button
     - Link to Fathom recording

4. **Create Tasks**:
   - Click "View in CRM" link from Slack
   - Review AI suggestions
   - Click "Create Task" on any suggestion
   - Task should be created in task list

**Expected Flow**:
```
Meeting Complete (Fathom)
    ↓
Webhook to Supabase
    ↓
AI Analysis (suggest-next-actions)
    ↓
next_action_suggestions created
    ↓
task_notifications created
    ↓
TRIGGER: notify_slack_for_task_notification()
    ↓
Edge Function: send-slack-task-notification
    ↓
Slack Message Sent
    ↓
User sees notification in Slack
```

### Test 3: Notification Preferences

1. **Disable Meeting Tasks**:
   - Go to Settings → Integrations → Slack
   - Toggle OFF "Meeting Task Notifications"
   - Save

2. **Record Another Meeting**:
   - Should get in-app notification
   - Should NOT get Slack notification

3. **Re-enable**:
   - Toggle back ON
   - Next meeting should send Slack notification again

---

## 🐛 Troubleshooting

### Issue 1: No Slack Notification Sent

**Symptoms**: In-app notification works, but no Slack message

**Debug Steps**:

1. **Check Edge Function Logs**:
```bash
# View logs for send-slack-task-notification
```
Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter: `send-slack-task-notification`

Look for errors

2. **Check Database Trigger**:
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_slack_task_notification';

-- Check if trigger is enabled
SELECT tgenabled FROM pg_trigger WHERE tgname = 'trigger_slack_task_notification';
```

3. **Check Slack Integration**:
```sql
-- Verify your Slack integration
SELECT * FROM slack_integrations WHERE user_id = auth.uid();

-- Check notification preferences
SELECT notification_types FROM slack_integrations WHERE user_id = auth.uid();
```

4. **Test Webhook Directly**:
```bash
# Test your Slack webhook URL directly
curl -X POST 'YOUR_SLACK_WEBHOOK_URL' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test from command line"
  }'
```

Expected: Message appears in Slack

### Issue 2: pg_net Extension Not Available

**Symptoms**: Error in logs about `net.http_post` not found

**Solution**: pg_net must be enabled (Step 2 above)

**Alternative**: If pg_net cannot be enabled, implement client-side Slack notifications:

**File**: `src/components/meetings/NextActionSuggestions.tsx`

Modify `handleAccept` function:
```typescript
const handleAccept = async (suggestionId: string) => {
  // ... existing code ...

  // After task creation, send Slack notification
  const { data: slackConfig } = await supabase
    .from('slack_integrations')
    .select('*')
    .eq('notifications_enabled', true)
    .single();

  if (slackConfig?.webhook_url && slackConfig.notification_types?.meeting_tasks) {
    // Send Slack notification via edge function
    await supabase.functions.invoke('send-slack-task-notification', {
      body: {
        notification_id: data.notification_id, // from task creation response
        user_id: (await supabase.auth.getUser()).data.user?.id
      }
    });
  }
};
```

### Issue 3: Webhook URL Validation Fails

**Symptoms**: "Invalid Slack webhook URL" error

**Solution**: Ensure URL format is exactly:
```
https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

Must:
- Start with `https://hooks.slack.com/services/`
- Have 3 path segments after `/services/`

### Issue 4: Service Role Key Not Found

**Symptoms**: Warning in logs about service role key being NULL

**Solution**: Re-run Step 3 to set database configuration:
```bash
npx supabase db execute --sql "ALTER DATABASE postgres SET app.settings.service_role_key = 'your-actual-key';"
```

### Issue 5: CORS Errors in Edge Function

**Symptoms**: Browser console shows CORS errors

**Solution**: Edge function already includes CORS headers. If still seeing errors:

1. Check if function is deployed with `--no-verify-jwt`
2. Verify edge function CORS headers are set
3. Check Supabase dashboard for CORS configuration

---

## 📊 Monitoring

### Check Slack Notification Success Rate

```sql
-- Count notifications sent
SELECT
  COUNT(*) FILTER (WHERE metadata->>'slack_sent' = 'true') as slack_sent,
  COUNT(*) as total_notifications,
  ROUND(
    COUNT(*) FILTER (WHERE metadata->>'slack_sent' = 'true')::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as success_rate_percent
FROM task_notifications
WHERE notification_type = 'meeting_tasks_available'
AND created_at > NOW() - INTERVAL '7 days';
```

### View Recent Slack Notifications

```sql
SELECT
  tn.created_at,
  tn.title,
  tn.task_count,
  tn.metadata->>'slack_sent' as slack_sent,
  tn.metadata->>'slack_sent_at' as slack_sent_at,
  m.title as meeting_title,
  u.email as user_email
FROM task_notifications tn
JOIN meetings m ON tn.meeting_id = m.id
JOIN auth.users u ON tn.user_id = u.id
WHERE tn.notification_type = 'meeting_tasks_available'
ORDER BY tn.created_at DESC
LIMIT 10;
```

---

## 🔐 Security Considerations

1. **Webhook URL Storage**:
   - Stored in database with RLS policies
   - Only visible to the user who owns it
   - Cannot be viewed by other users

2. **Service Role Key**:
   - Stored in database configuration (secure)
   - Used only by database triggers
   - Never exposed to client

3. **Edge Function**:
   - Uses service role internally
   - Validates notification ownership
   - No unauthorized access possible

4. **Slack Webhooks**:
   - One-way communication (CRM → Slack only)
   - Cannot be used to read Slack data
   - Limited to posting messages only

---

## 🎯 Success Criteria

After deployment, you should have:

✅ Slack integration table created
✅ Edge function deployed and accessible
✅ Database trigger active
✅ Settings UI accessible
✅ Test notification working
✅ Real meeting notifications working
✅ Notification preferences respected

---

## 📚 Additional Resources

- **Slack Webhook Documentation**: https://api.slack.com/messaging/webhooks
- **Slack Message Formatting**: https://api.slack.com/reference/surfaces/formatting
- **Slack Block Kit Builder**: https://app.slack.com/block-kit-builder
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **pg_net Extension**: https://github.com/supabase/pg_net

---

## 🔄 Rollback Plan

If you need to rollback the deployment:

```bash
# Disable the trigger
npx supabase db execute --sql "
  ALTER TABLE task_notifications
  DISABLE TRIGGER trigger_slack_task_notification;
"

# Or drop the trigger entirely
npx supabase db execute --sql "
  DROP TRIGGER IF EXISTS trigger_slack_task_notification ON task_notifications;
"

# Remove edge function
npx supabase functions delete send-slack-task-notification
```

Data in `slack_integrations` table will remain for future use.

---

**Need Help?** Check the troubleshooting section or review the edge function logs for detailed error messages.
