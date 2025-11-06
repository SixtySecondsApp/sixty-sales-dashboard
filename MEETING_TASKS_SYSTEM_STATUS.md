# 📋 Meeting Tasks System - Current Status & Implementation

## ✅ What's Already Implemented

### 1. Automatic Task Creation DISABLED
**Status**: ✅ **COMPLETED**

The automatic trigger has been disabled via migration:
- File: `supabase/migrations/20251031000001_disable_automatic_action_item_task_sync.sql`
- Trigger `trigger_auto_create_task_from_action_item` has been **DROPPED**
- Function `auto_create_task_from_action_item()` still exists for manual use
- Tasks are NO LONGER created automatically when meetings sync

### 2. Manual Task Creation UI
**Status**: ✅ **ALREADY EXISTS**

The UI already has manual task creation built-in:
- Component: `src/components/meetings/NextActionSuggestions.tsx`
- Features:
  - **"Create Task" button** for each AI suggestion
  - **"Extract More Tasks" button** to analyze meeting for additional tasks
  - **Dismiss button** to ignore suggestions
  - Visual badges showing priority, confidence, category
  - Expandable cards with full reasoning
  - Playback timestamps to jump to relevant meeting moments

**User Flow**:
1. User views meeting details
2. AI suggestions appear in "AI Suggestions" section
3. User clicks "Create Task" on any suggestion
4. Task is created and appears in task list
5. Suggestion marked as "accepted"

### 3. In-App Notifications
**Status**: ✅ **FULLY FUNCTIONAL**

Real-time notification system already implemented:
- Hook: `src/lib/hooks/useTaskNotifications.ts`
- Database Table: `task_notifications`
- Features:
  - Real-time subscriptions (Supabase Realtime)
  - Toast notifications with "View Meeting" action
  - Unread count tracking
  - Mark as read functionality
  - Auto-dismiss on interaction

**Notification Triggers**:
- When tasks are created from meeting action items
- Upcoming task deadlines
- Overdue tasks
- Manual sync operations

### 4. Slack Integration Infrastructure
**Status**: ⚠️ **PARTIALLY IMPLEMENTED**

Existing components:
- Service: `src/lib/services/slackService.ts`
- OAuth Service: `src/lib/services/slackOAuthService.ts`
- Integration Utils: `src/lib/utils/slackIntegration.ts`

**Current Capabilities**:
- Send messages via Slack webhook
- Format deal notifications for Slack
- Rich message formatting with blocks and attachments
- User mentions support

**Missing**:
- Slack notification for meeting task suggestions
- Integration with task notification system

---

## 🎯 What Needs to Be Added

### Only Missing Feature: Slack Notifications for Meeting Tasks

We need to create a database function and edge function to send Slack notifications when:
1. New meeting has AI-suggested tasks available
2. Tasks are created from meetings
3. Meeting tasks are approaching deadline

**Implementation Required**:

#### Option A: Database Trigger + Edge Function (Recommended)
1. **Create Edge Function**: `supabase/functions/send-slack-task-notification`
2. **Modify Notification Trigger**: Update existing notification trigger to call Slack function
3. **Add Slack Config**: Store Slack webhook URL per user in `user_settings` or `integrations` table

#### Option B: Client-Side Slack Integration
1. **Modify NextActionSuggestions Component**: Add Slack notification on task creation
2. **Use Existing SlackService**: Call `sendWebhookMessage` after successful task creation
3. **User Preference**: Add toggle in settings to enable/disable Slack notifications

---

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Fathom Meeting Webhook                                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: fathom-webhook                               │
│ - Processes meeting                                         │
│ - Calls suggest-next-actions Edge Function                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: suggest-next-actions                        │
│ - Analyzes transcript with AI                              │
│ - Creates records in next_action_suggestions table         │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Database: next_action_suggestions table                    │
│ - Stores AI suggestions (status: 'pending')                │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 🔔 NOTIFICATION CREATED HERE                                │
│ Trigger: after_insert_next_action_suggestion               │
│ - Creates task_notification record                         │
│ - Type: 'meeting_tasks_available'                          │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Real-time Updates                                           │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ In-App          │  │ Slack           │                  │
│ │ (useTaskNoti... │  │ (NEW - TBD)     │                  │
│ │ ✅ WORKING      │  │ ❌ NOT IMPL     │                  │
│ └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: NextActionSuggestions Component                  │
│ - User sees AI suggestions                                  │
│ - Clicks "Create Task" (MANUAL)                            │
│ - Calls: accept_next_action_suggestion()                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Database Function: accept_next_action_suggestion           │
│ - Creates task record                                       │
│ - Links to meeting and action item                         │
│ - Updates suggestion status to 'accepted'                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔔 Current Notification Flow

### In-App Notifications (✅ Working)

**Trigger**: After AI suggestions are created

```sql
-- Existing trigger in database
CREATE TRIGGER after_insert_next_action_suggestion
  AFTER INSERT ON next_action_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION create_task_notification();
```

**Function**: Creates notification record
```sql
INSERT INTO task_notifications (
  user_id,
  meeting_id,
  notification_type,
  title,
  message,
  task_count,
  metadata
) VALUES (...)
```

**Frontend**: Real-time subscription
```typescript
// useTaskNotifications.ts
supabase.channel('task_notifications')
  .on('INSERT', { filter: `user_id=eq.${user.id}` }, (payload) => {
    setNotifications(prev => [payload.new, ...prev]);
    showNotificationToast(payload.new); // ← Shows toast!
  })
```

### Slack Notifications (❌ Not Implemented)

**What's needed**:
1. Edge function to send Slack message
2. Trigger to call edge function after notification created
3. User setting to enable/disable Slack notifications
4. Slack webhook URL storage per user

---

## 🛠️ Implementation Plan for Slack Notifications

### Step 1: Create Slack Notification Edge Function

**File**: `supabase/functions/send-slack-task-notification/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { notification_id, user_id } = await req.json()

    // Get notification details
    const supabase = createClient(...)
    const { data: notification } = await supabase
      .from('task_notifications')
      .select(`
        *,
        meeting:meetings(title, share_url)
      `)
      .eq('id', notification_id)
      .single()

    // Get user's Slack webhook URL
    const { data: slackConfig } = await supabase
      .from('slack_integrations')
      .select('webhook_url, notifications_enabled')
      .eq('user_id', user_id)
      .eq('notifications_enabled', true)
      .single()

    if (!slackConfig?.webhook_url) {
      return new Response(JSON.stringify({
        success: false,
        reason: 'No Slack integration enabled'
      }), { status: 200 })
    }

    // Format Slack message
    const slackMessage = {
      text: notification.title,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${notification.title}*\n${notification.message}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Meeting:*\n${notification.meeting?.title || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Tasks:*\n${notification.task_count} available`
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View in CRM"
              },
              url: `${process.env.APP_URL}/meetings/${notification.meeting_id}`
            }
          ]
        }
      ]
    }

    // Send to Slack
    const response = await fetch(slackConfig.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Step 2: Create Database Trigger

**File**: `supabase/migrations/[timestamp]_add_slack_task_notifications.sql`

```sql
-- Create Slack integrations table if not exists
CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_name TEXT,
  webhook_url TEXT NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{"meeting_tasks": true, "deadlines": true, "overdue": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create function to call Slack edge function
CREATE OR REPLACE FUNCTION notify_slack_for_task_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_has_slack_integration BOOLEAN;
BEGIN
  -- Check if user has Slack integration enabled
  SELECT EXISTS(
    SELECT 1 FROM slack_integrations
    WHERE user_id = NEW.user_id
    AND notifications_enabled = true
    AND notification_types->>'meeting_tasks' = 'true'
  ) INTO v_has_slack_integration;

  IF v_has_slack_integration THEN
    -- Call Edge Function asynchronously
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-slack-task-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'user_id', NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_slack_task_notification
  AFTER INSERT ON task_notifications
  FOR EACH ROW
  WHEN (NEW.notification_type IN ('meeting_tasks_available', 'tasks_created_from_meeting'))
  EXECUTE FUNCTION notify_slack_for_task_notification();
```

### Step 3: Add Slack Configuration UI

**File**: `src/pages/Settings.tsx` (add new section)

```typescript
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

function SlackIntegrationSettings() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [notifyMeetingTasks, setNotifyMeetingTasks] = useState(true);
  const [loading, setLoading] = useState(false);

  // Load existing configuration
  useEffect(() => {
    loadSlackConfig();
  }, []);

  const loadSlackConfig = async () => {
    const { data, error } = await supabase
      .from('slack_integrations')
      .select('*')
      .single();

    if (data) {
      setWebhookUrl(data.webhook_url || '');
      setEnabled(data.notifications_enabled);
      setNotifyMeetingTasks(data.notification_types?.meeting_tasks ?? true);
    }
  };

  const saveSlackConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('slack_integrations')
        .upsert({
          webhook_url: webhookUrl,
          notifications_enabled: enabled,
          notification_types: {
            meeting_tasks: notifyMeetingTasks,
            deadlines: true,
            overdue: true
          }
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast.success('Slack integration saved!');
    } catch (error: any) {
      toast.error('Failed to save Slack integration', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Slack Notifications</h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Slack Webhook URL</label>
            <Input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Create an incoming webhook in your Slack workspace settings
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Slack Notifications</p>
              <p className="text-sm text-gray-500">
                Receive notifications in Slack
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Meeting Task Notifications</p>
              <p className="text-sm text-gray-500">
                Get notified when AI finds tasks in meetings
              </p>
            </div>
            <Switch
              checked={notifyMeetingTasks}
              onCheckedChange={setNotifyMeetingTasks}
              disabled={!enabled}
            />
          </div>

          <Button
            onClick={saveSlackConfig}
            disabled={loading || !webhookUrl}
          >
            {loading ? 'Saving...' : 'Save Slack Integration'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## 📝 Summary

### ✅ What's Already Working
1. **Manual Task Creation**: UI with "Create Task" buttons
2. **In-App Notifications**: Real-time toast notifications
3. **AI Suggestions**: Automatic analysis of meeting transcripts
4. **Task Management**: Full CRUD operations on tasks
5. **Notification System**: Database table + real-time subscriptions

### ❌ What's Missing
1. **Slack Notifications**: Need to implement edge function + trigger
2. **Slack Configuration UI**: Add settings page section
3. **Slack Integration Table**: Database table for webhook URLs

### 🎯 Implementation Priority
**Priority 1 (Essential)**:
- Add Slack integration table migration
- Create `send-slack-task-notification` edge function
- Add database trigger for Slack notifications

**Priority 2 (UX Enhancement)**:
- Add Slack configuration section to Settings page
- Add Slack webhook URL validation
- Add test notification button

**Priority 3 (Nice-to-Have)**:
- Slack OAuth integration (instead of manual webhook)
- Notification preferences per notification type
- Slack thread support for task discussions

---

## 🚀 Quick Start for Slack Implementation

**Option A: Simple Webhook Integration (Recommended First)**
1. Add `slack_integrations` table
2. Create edge function for Slack notifications
3. Add trigger to send Slack messages
4. Add settings UI for webhook URL
5. Test with new meeting

**Option B: Full Slack OAuth (More Complex)**
1. Register Slack app
2. Implement OAuth flow
3. Store access tokens
4. Use Slack API instead of webhooks
5. Support multiple workspaces

**Recommended**: Start with Option A (webhooks), upgrade to Option B later if needed.
