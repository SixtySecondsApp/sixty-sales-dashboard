# Complete Slack OAuth Integration Setup Guide

## ✅ Current Status: PRODUCTION READY
This Slack OAuth integration is now fully functional and tested. Follow this guide to set it up.

## 🎯 What You'll Get
- **OAuth Authentication** - No webhook URLs needed
- **Dynamic Channel Selection** - Choose from your workspace channels
- **Rich Message Support** - Text messages AND Slack Blocks
- **Variable Substitution** - `{{deal_name}}`, `{{company}}`, `{{value}}`, etc.
- **Test Functionality** - Preview messages before deployment
- **Success Notifications** - Beautiful UI feedback

## Step 1: Create Database Tables (REQUIRED)

### ⚡ Quick Setup (Recommended)
1. Go to: **https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new**
2. Copy ALL contents from **`SLACK_TABLES_SAFE.sql`** (handles existing policies gracefully)
3. Paste into SQL Editor and click **"Run"**
4. You should see: `"Tables created successfully!"` and both tables listed

### Alternative: Use Migration File
Copy contents from: `supabase/migrations/20250905203303_create_slack_integration_tables.sql`

### ✅ Verification
You should see both tables in the final query result:
```json
[
  {"table_name": "slack_channels"},
  {"table_name": "slack_integrations"}
]
```

## Step 2: Test the Integration 🚀

### Connect Your Slack Workspace
1. Go to: **https://sales.sixtyseconds.video/workflows**
2. Click the **"Connect Slack"** button
3. Authorize the app in your Slack workspace
4. You'll see a beautiful **green success notification**: *"Slack Connected Successfully!"*
5. The URL will clean up automatically (no more `?slack_connected=true`)

### ✅ Success Indicators
- **Green notification** appears and auto-hides after 5 seconds
- **Connected status** shows in the SlackConnectionButton  
- **Workspace name** displayed with green indicator dot
- **Test button** available to send test messages

## Step 3: Create Rich Slack Workflows 🎨

### Available Message Types
1. **Simple Message** - Basic text with variables
2. **Deal Notification** - Formatted deal updates with options
3. **Task Created** - Task notification templates
4. **Custom Message** - Free-form text with variables
5. **🆕 Rich Message (Blocks)** - Full Slack Block Kit support!

### Using Slack Blocks
Select "Rich Message (Blocks)" and use this sample JSON:
```json
[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn", 
      "text": "🎉 *New deal created:* {{deal_name}}\n💰 *Value:* ${{value}}\n🏢 *Company:* {{company}}\n📊 *Stage:* {{stage}}"
    }
  },
  {
    "type": "actions",
    "elements": [
      {
        "type": "button",
        "text": {"type": "plain_text", "text": "View Deal"},
        "style": "primary",
        "url": "https://sales.sixtyseconds.video/crm/pipeline"
      }
    ]
  }
]
```

### 🧪 Testing Features
- **Validate JSON** - Check blocks syntax
- **Test Blocks** - Send preview to selected channel  
- **Test Channel** - Send simple test message
- **Refresh channels** - Update channel list

## Step 4: Variables You Can Use 📊

All message types support these variables:
- `{{deal_name}}` - Name of the deal
- `{{company}}` - Company name  
- `{{value}}` - Deal value (formatted as currency)
- `{{stage}}` - Current pipeline stage
- `{{owner}}` - Deal owner name
- `{{expected_close_date}}` - Expected close date
- `{{priority}}` - Deal priority level

## Step 5: Advanced Features 🔧

### Channel Selection
- **Dynamic dropdown** of all workspace channels
- **Privacy indicators** (🔒 for private channels)
- **Auto-refresh** to get latest channels
- **Public channel auto-join** if bot isn't a member

### Workflow Integration
- **Drag & drop** Slack action nodes
- **Multiple triggers** (Deal Created, Stage Changed, Activity Created, etc.)
- **Conditional logic** for smart notifications
- **Save & test** functionality before going live

### Rich Formatting Options
- **Markdown** in text messages (*bold*, _italic_, `code`)
- **Mentions** - Add @username mentions
- **Links** - Include deal links and buttons
- **Emojis** - Full emoji support 🎉
- **Blocks** - Sections, dividers, images, buttons, and more

## 🛠️ Technical Details

### Files & Components
- **Database Tables**: `slack_integrations`, `slack_channels`
- **Edge Functions**: 
  - `slack-oauth-callback` (OAuth flow)
  - `send-slack-message` (Message sending)
- **Frontend Components**:
  - `SlackConnectionButton.tsx` (Connection UI)
  - `WorkflowCanvas.tsx` (Workflow builder)
  - `slackOAuthService.ts` (API service)

### Security Features
- **OAuth 2.0** authentication (no webhook URLs)
- **Row Level Security** on database tables
- **Service role access** for Edge Functions
- **Token encryption** and secure storage
- **User isolation** (users only see their own integrations)

### Performance & Reliability
- **Channel caching** for fast dropdown population
- **Automatic retries** for failed messages
- **Auto-join** for public channels
- **Graceful error handling** with user feedback
- **Connection status** monitoring

## 🚨 Troubleshooting

### Issue: Tables don't exist (406/404 errors)
**Solution:** Run the `SLACK_TABLES_SAFE.sql` script in Supabase SQL Editor

### Issue: OAuth fails with client_id error
**Solution:** Environment variables are set correctly - this shouldn't happen

### Issue: Can't send messages
**Solution:** Check the Edge Function logs at:
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/send-slack-message

### Issue: Channels not loading
**Solution:** Use the "Refresh channels" button or disconnect/reconnect Slack

## 🎉 You're Done!

Your Slack integration now supports:
- ✅ OAuth authentication with dynamic channels
- ✅ Rich message formatting with Slack Blocks  
- ✅ Variable substitution for dynamic content
- ✅ Test functionality before deployment
- ✅ Beautiful success notifications
- ✅ Production-ready security and performance

Create workflows that send everything from simple notifications to rich interactive messages with buttons and formatting!