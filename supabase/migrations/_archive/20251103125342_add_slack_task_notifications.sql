-- Migration: Add Slack Task Notifications
-- Purpose: Enable Slack notifications when meeting tasks are available
-- Date: 2025-11-03

-- Create Slack integrations table
CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workspace_name TEXT,
  webhook_url TEXT NOT NULL,
  notifications_enabled BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{"meeting_tasks": true, "deadlines": true, "overdue": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add RLS policies for slack_integrations
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own Slack integration
CREATE POLICY "Users can view own Slack integration"
  ON slack_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own Slack integration
CREATE POLICY "Users can insert own Slack integration"
  ON slack_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own Slack integration
CREATE POLICY "Users can update own Slack integration"
  ON slack_integrations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own Slack integration
CREATE POLICY "Users can delete own Slack integration"
  ON slack_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_slack_integrations_updated_at
  BEFORE UPDATE ON slack_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE slack_integrations IS 'Stores Slack webhook URLs and notification preferences for users';
COMMENT ON COLUMN slack_integrations.webhook_url IS 'Slack incoming webhook URL for sending notifications';
COMMENT ON COLUMN slack_integrations.notifications_enabled IS 'Master toggle for all Slack notifications';
COMMENT ON COLUMN slack_integrations.notification_types IS 'JSON object with notification type preferences: {meeting_tasks, deadlines, overdue}';

-- Create function to send Slack notification asynchronously
CREATE OR REPLACE FUNCTION notify_slack_for_task_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_has_slack_integration BOOLEAN;
  v_function_url TEXT;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Check if user has Slack integration enabled for this notification type
  SELECT EXISTS(
    SELECT 1 FROM slack_integrations
    WHERE user_id = NEW.user_id
    AND notifications_enabled = true
    AND (
      (NEW.notification_type = 'meeting_tasks_available' AND notification_types->>'meeting_tasks' = 'true')
      OR (NEW.notification_type = 'upcoming_deadline' AND notification_types->>'deadlines' = 'true')
      OR (NEW.notification_type = 'overdue_task' AND notification_types->>'overdue' = 'true')
    )
  ) INTO v_has_slack_integration;

  IF v_has_slack_integration THEN
    -- Get Supabase URL and service role key from environment
    -- Note: These should be set via ALTER DATABASE SET or connection parameters
    BEGIN
      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_service_role_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      -- Fallback to default if settings not configured
      RAISE WARNING 'Supabase URL or service role key not configured in database settings';
      RETURN NEW;
    END;

    IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
      RAISE WARNING 'Supabase URL or service role key is NULL, skipping Slack notification';
      RETURN NEW;
    END IF;

    -- Build edge function URL
    v_function_url := v_supabase_url || '/functions/v1/send-slack-task-notification';

    -- Call Edge Function asynchronously using pg_net extension
    -- Note: This requires pg_net extension to be enabled
    -- If pg_net is not available, notifications will be sent via client-side trigger instead
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'notification_id', NEW.id,
          'user_id', NEW.user_id
        )
      );

      RAISE LOG 'Slack notification queued for notification_id: %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- If pg_net fails, log the error but don't fail the transaction
      RAISE WARNING 'Failed to queue Slack notification: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to function
COMMENT ON FUNCTION notify_slack_for_task_notification() IS 'Triggers Slack notifications for task-related events via Edge Function';

-- Create trigger to send Slack notifications
CREATE TRIGGER trigger_slack_task_notification
  AFTER INSERT ON task_notifications
  FOR EACH ROW
  WHEN (NEW.notification_type IN ('meeting_tasks_available', 'tasks_created_from_meeting', 'upcoming_deadline', 'overdue_task'))
  EXECUTE FUNCTION notify_slack_for_task_notification();

-- Add comment to trigger
COMMENT ON TRIGGER trigger_slack_task_notification ON task_notifications IS 'Sends Slack notifications when tasks are created or deadlines approach';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_slack_integrations_user_enabled
  ON slack_integrations(user_id, notifications_enabled)
  WHERE notifications_enabled = true;

-- Note: To enable pg_net extension, run: CREATE EXTENSION IF NOT EXISTS pg_net;
-- If pg_net is not available, Slack notifications can be sent via client-side logic instead
