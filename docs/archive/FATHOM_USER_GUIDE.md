# Fathom Integration - User Guide

## 🚀 How to Connect Fathom

### Step 1: Navigate to Integrations Page

1. Open your CRM application
2. Click on **Integrations** in the navigation menu
3. Scroll down to find the **Fathom Integration** section

### Step 2: Connect Your Fathom Account

1. Click the **"Connect Fathom Account"** button
2. You'll be redirected to Fathom's authorization page
3. Sign in to your Fathom account (if not already signed in)
4. Review the permissions being requested:
   - **Read calls**: Access your meeting recordings and metadata
   - **Read analytics**: Access call analytics and insights
   - **Write highlights**: Create highlights from CRM (future feature)
5. Click **"Authorize"** to grant access
6. You'll be redirected back to the CRM with a success message

### Step 3: Configure Sync Settings (Optional)

After connecting, you can:

**Quick Sync** - Syncs the last 30 days of meetings immediately
- Click the **"Quick Sync"** button
- Wait for the sync to complete (~30 seconds for 5 meetings)

**Custom Sync Range** - Choose specific dates to sync
- Click **"Custom Sync Range"**
- Select sync type:
  - **Manual**: Last 30 days
  - **Incremental**: Last 24 hours
  - **Initial**: Custom date range
- Set start and end dates (for Initial sync)
- Click **"Start Sync"**

---

## 📊 What Gets Synced

### Meeting Data
- **Title**: Meeting subject
- **Duration**: Length of the meeting
- **Recording URL**: Link to watch the Fathom recording
- **Transcript**: Full meeting transcript (if available)
- **AI Summary**: Fathom's AI-generated summary
- **Host/Participants**: Who attended the meeting

### Analytics
- **Sentiment Score**: Overall meeting sentiment (-1 to 1)
- **Talk Time Analysis**: Rep vs Customer speaking percentages
- **Talk Time Judgment**: Assessment of talk time balance

### Action Items
- **Title**: Description of the action item
- **Priority**: Urgency level (urgent, high, medium, low)
- **Category**: Type of action (call, email, proposal, etc.)
- **Timestamp**: When it was mentioned in the recording
- **Playback Link**: Jump directly to that moment in the recording

### Attendees
- **Name and Email**: Contact information
- **Role**: Host or attendee
- **External/Internal**: Company affiliation

---

## 🔄 Automatic Sync

Once connected, your Fathom meetings will sync automatically:

**Hourly Sync** (Automated)
- Runs every hour at the top of the hour
- Syncs meetings from the last 24 hours
- No action required from you

**Webhook Updates** (Real-time)
- When a recording becomes available in Fathom
- Immediate sync of that specific meeting
- Fastest way to get new meetings into your CRM

---

## 👀 Viewing Meetings

### Meetings List
1. Navigate to **Meetings** in the main menu
2. View all synced Fathom recordings
3. Click on any meeting to see details

### Meeting Detail Page
Each meeting has its own detail page showing:

**Summary Tab**
- AI-generated summary
- Embedded recording player (watch directly in CRM)

**Attendees Tab**
- Full list of participants
- Email addresses and roles
- External/internal indicators

**Action Items Tab**
- All identified action items
- Priority and category badges
- Timestamp links to playback at that moment
- Completion status

**Analytics Tab**
- Talk time distribution chart
- Sentiment analysis
- Meeting metadata

### Deep Links
You can share direct links to meetings:
```
https://your-crm.com/meetings/{meeting-id}
```

Use these links in:
- Email notifications to reps
- Slack messages
- Task descriptions
- Calendar event notes

---

## ⚙️ Managing Your Integration

### View Connection Status

In the **Integrations** page, the Fathom section shows:
- ✅ **Connected** badge when active
- Connected email account
- Permissions granted
- Token expiry date
- Last sync timestamp

### Sync Status Dashboard

Monitor your sync progress:
- **Meetings Synced**: Total count synced
- **Total Found**: Total available in Fathom
- **Last Synced**: Timestamp of last successful sync
- **Status**: Idle, Syncing, or Error

### Troubleshooting

**"No active Fathom integration found"**
- You need to connect Fathom first via the OAuth flow

**"Token expired" errors**
- Tokens auto-refresh automatically
- If issues persist, disconnect and reconnect

**Sync not working**
- Check your Fathom integration status
- Verify you have meetings in the selected date range
- Try a manual quick sync

### Disconnect

To disconnect your Fathom account:
1. Go to **Integrations** page
2. Scroll to Fathom section
3. Click **"Disconnect Fathom"**
4. Confirm the action
5. All synced data remains in your CRM, but no new meetings will sync

---

## 🎯 Best Practices

### Initial Setup
1. Connect Fathom account
2. Run an initial sync for last 30 days
3. Verify meetings appear correctly
4. Let hourly sync handle ongoing updates

### Daily Usage
1. Meetings auto-sync every hour
2. Check notification emails for new meetings
3. Click meeting links to view details
4. Review action items and assign tasks

### Notifications (Coming Soon)
- Email alerts when new meetings are available
- Action item notifications to assigned reps
- Weekly meeting summaries

---

## 🔒 Security & Privacy

**Data Storage**
- OAuth tokens encrypted in database
- Tokens auto-refresh before expiry
- User-isolated data (you only see your meetings)

**Permissions**
- **Read-only** for calls and analytics
- **Write** only for highlights (future feature)
- No access to other Fathom users' data

**Disconnecting**
- You can disconnect at any time
- Synced data remains in your CRM
- Tokens are immediately revoked

---

## 📞 Support

If you encounter issues:

1. **Check Integration Status**: Verify connection in Integrations page
2. **Try Manual Sync**: Use Quick Sync to test connectivity
3. **Check Logs**: Admin users can view sync logs in database
4. **Contact Support**: Provide your email and error message

Common questions answered in `FATHOM_INTEGRATION_COMPLETE.md`
