-- Migration: Create Task Notifications System
-- Description: Track when tasks are auto-created from AI suggestions
-- Author: Claude
-- Date: 2025-01-01

-- ============================================================================
-- PHASE 1: Create task_notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'tasks_created', 'suggestion_accepted', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_id ON task_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_meeting_id ON task_notifications(meeting_id);
CREATE INDEX IF NOT EXISTS idx_task_notifications_created_at ON task_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_notifications_read ON task_notifications(read) WHERE read = false;

-- ============================================================================
-- PHASE 2: Enable RLS
-- ============================================================================

ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications (idempotent)
DROP POLICY IF EXISTS "Users can view their own notifications" ON task_notifications;
CREATE POLICY "Users can view their own notifications"
  ON task_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read (idempotent)
DROP POLICY IF EXISTS "Users can update their own notifications" ON task_notifications;
CREATE POLICY "Users can update their own notifications"
  ON task_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications (idempotent)
DROP POLICY IF EXISTS "System can insert notifications" ON task_notifications;
CREATE POLICY "System can insert notifications"
  ON task_notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PHASE 3: Function to create notification when tasks auto-created
-- ============================================================================

CREATE OR REPLACE FUNCTION create_task_creation_notification(
  p_user_id UUID,
  p_meeting_id UUID,
  p_meeting_title TEXT,
  p_task_count INTEGER,
  p_task_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Build notification title and message
  v_title := p_task_count || ' task' || (CASE WHEN p_task_count > 1 THEN 's' ELSE '' END) || ' created';
  v_message := 'AI generated ' || p_task_count || ' task' || (CASE WHEN p_task_count > 1 THEN 's' ELSE '' END) ||
               ' from meeting: ' || p_meeting_title;

  -- Insert notification
  INSERT INTO task_notifications (
    user_id,
    meeting_id,
    notification_type,
    title,
    message,
    task_count,
    metadata,
    read,
    created_at
  ) VALUES (
    p_user_id,
    p_meeting_id,
    'tasks_created',
    v_title,
    v_message,
    p_task_count,
    jsonb_build_object(
      'task_ids', p_task_ids,
      'meeting_title', p_meeting_title,
      'source', 'ai_auto_creation'
    ),
    false,
    NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: Function to mark notification as read
-- ============================================================================

-- Drop existing function if it exists (to handle return type changes)
-- Must specify exact parameter types for DROP FUNCTION
DROP FUNCTION IF EXISTS mark_notification_read(p_notification_id UUID);

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE task_notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 5: Function to mark all notifications as read
-- ============================================================================

-- Drop existing function if it exists (to handle return type changes)
DROP FUNCTION IF EXISTS mark_all_notifications_read();

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE task_notifications
  SET read = true
  WHERE user_id = auth.uid()
    AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 6: Grant Permissions
-- ============================================================================

GRANT SELECT, UPDATE ON task_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_task_creation_notification TO service_role;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;

-- ============================================================================
-- PHASE 7: Comments
-- ============================================================================

COMMENT ON TABLE task_notifications IS 'Stores notifications for task creation and AI suggestions';
COMMENT ON FUNCTION create_task_creation_notification IS 'Creates notification when tasks are auto-created from AI suggestions';
COMMENT ON FUNCTION mark_notification_read IS 'Marks a specific notification as read';
COMMENT ON FUNCTION mark_all_notifications_read IS 'Marks all user notifications as read';
