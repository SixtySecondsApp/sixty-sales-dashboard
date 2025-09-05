# Slack Integration Setup Guide

## Overview
The Sixty Sales workflow system now supports Slack notifications! You can send automated messages to Slack channels when deals are created, updated, or when any workflow trigger fires.

## Setup Instructions

### Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter app details:
   - **App Name**: Sixty Sales Bot (or your preferred name)
   - **Workspace**: Select your Slack workspace
5. Click **"Create App"**

### Step 2: Enable Incoming Webhooks

1. In your app's settings page, find **"Incoming Webhooks"** in the left sidebar
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Click **"Add New Webhook to Workspace"**
4. Select the channel where you want to post messages
5. Click **"Allow"**
6. Copy the webhook URL (it looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

### Step 3: Add More Channels (Optional)

Each channel needs its own webhook URL. To post to multiple channels:

1. Go back to **"Incoming Webhooks"** in your app settings
2. Click **"Add New Webhook to Workspace"** again
3. Select a different channel
4. Copy the new webhook URL for that channel

> **Note**: Each webhook URL is tied to a specific channel. You cannot dynamically change channels with a single webhook URL.

## Using Slack in Workflows

### 1. Create or Edit a Workflow

1. Go to the Workflows page in Sixty Sales
2. Create a new workflow or edit an existing one
3. Add an **Action** node
4. Select **"Send Slack"** as the action type

### 2. Configure Slack Settings

#### Basic Configuration:
- **Webhook URL**: Paste the webhook URL from Step 2
- **Test Webhook**: Click the "Test Webhook" button to verify the connection

#### Message Types:

**Simple Message**
- Basic text message with variable support
- Example: `🎉 New deal created: {{deal_name}}`

**Deal Notification**
- Rich formatted message with deal details
- Includes company, value, stage, and owner information
- Options to include deal link and owner details

**Task Created**
- Formatted task notification
- Shows task title, description, priority, and due date

**Custom Message**
- Fully customizable message with variable interpolation
- Use any trigger data variables

#### Available Variables:
- `{{deal_name}}` - Name of the deal
- `{{company}}` - Company name
- `{{value}}` - Deal value
- `{{stage}}` - Current pipeline stage
- `{{owner}}` - Deal owner name

#### Advanced Options:
- **Mention Users**: Enter Slack user IDs (comma-separated) to mention specific users
  - Example: `@john, @sarah`
- **Include Deal Link**: Adds a button to view the deal in Sixty Sales (Deal Notification only)
- **Include Owner**: Shows deal owner information (Deal Notification only)

### 3. Test Your Configuration

1. After entering the webhook URL, click the **"Test Webhook"** button
2. Check your Slack channel for the test message
3. If successful, you'll see a confirmation message

### 4. Save and Activate

1. Save your workflow
2. Toggle the workflow to **Active**
3. Your Slack notifications will now trigger based on your workflow conditions!

## Example Use Cases

### 1. New High-Value Deal Alert
**Trigger**: Deal Created  
**Condition**: Deal value > $50,000  
**Action**: Send Slack (Deal Notification)  
**Channel**: #sales-wins  

### 2. Deal Won Celebration
**Trigger**: Stage Changed  
**Condition**: New stage = "Signed"  
**Action**: Send Slack (Custom Message)  
**Message**: `🎊 DEAL WON! {{deal_name}} - {{value}} 🎊`  
**Channel**: #team-announcements  

### 3. Task Assignment Notification
**Trigger**: Task Created  
**Action**: Send Slack (Task Created)  
**Channel**: #sales-tasks  

### 4. Weekly Pipeline Summary
**Trigger**: Schedule (Every Monday)  
**Action**: Send Slack (Custom Message)  
**Message**: Custom pipeline summary  
**Channel**: #sales-reports  

## Troubleshooting

### Test Webhook Fails
- Verify the webhook URL is correct and complete
- Check that the Slack app is installed in your workspace
- Ensure the webhook is still active (not revoked)

### Messages Not Appearing
- Check the workflow is activated
- Verify the trigger conditions are being met
- Check the Slack channel for the message
- Review workflow execution logs

### Wrong Channel
- Remember: Each webhook URL is tied to a specific channel
- To change channels, you need a different webhook URL
- Create a new webhook for each channel you want to post to

## Security Notes

- Webhook URLs should be kept secure and not shared publicly
- Each webhook URL has full posting access to its designated channel
- Revoke unused webhooks from your Slack app settings
- Consider using private channels for sensitive information

## Need Help?

If you encounter any issues:
1. Check the workflow execution logs in Sixty Sales
2. Verify your Slack app settings at [api.slack.com/apps](https://api.slack.com/apps)
3. Test the webhook using the built-in test button
4. Contact support with your workflow ID and error details