-- Migration: Fathom Action Items to Tasks Sync System
-- Description: Enable bidirectional sync between meeting action items and CRM tasks
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- PHASE 1: Schema Updates
-- ============================================================================

-- Add reverse lookup column to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS meeting_action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE SET NULL;

-- Add sync tracking fields to meeting_action_items
ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS synced_to_task BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'failed', 'excluded')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_action_item ON tasks(meeting_action_item_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_task_id ON meeting_action_items(task_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_email ON meeting_action_items(assignee_email);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_sync_status ON meeting_action_items(sync_status);

-- ============================================================================
-- PHASE 2: Helper Functions for Sales Rep Identification
-- ============================================================================

-- Function to check if email belongs to an internal user (sales rep)
CREATE OR REPLACE FUNCTION is_internal_assignee(email_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if email matches a user in auth.users
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = email_input
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user ID from email
CREATE OR REPLACE FUNCTION get_user_id_from_email(email_input TEXT)
RETURNS UUID AS $$
DECLARE
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = email_input
  LIMIT 1;

  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PHASE 3: Automated Task Creation from Action Items
-- ============================================================================

-- Main trigger function to auto-create tasks from action items
CREATE OR REPLACE FUNCTION auto_create_task_from_action_item()
RETURNS TRIGGER AS $$
DECLARE
  assignee_user_id UUID;
  meeting_owner_id UUID;
  meeting_title_text TEXT;
  task_priority TEXT;
  new_task_id UUID;
BEGIN
  -- Only process if not already synced
  IF NEW.task_id IS NOT NULL OR NEW.synced_to_task = true THEN
    RETURN NEW;
  END IF;

  -- Get meeting details
  SELECT owner_user_id, title INTO meeting_owner_id, meeting_title_text
  FROM meetings
  WHERE id = NEW.meeting_id;

  -- Only process if assignee is internal (sales rep)
  IF NEW.assignee_email IS NOT NULL AND NOT is_internal_assignee(NEW.assignee_email) THEN
    -- External assignee - exclude from sync
    NEW.sync_status := 'excluded';
    NEW.synced_to_task := false;
    RETURN NEW;
  END IF;

  -- Determine assignee
  IF NEW.assignee_email IS NOT NULL THEN
    assignee_user_id := get_user_id_from_email(NEW.assignee_email);
  END IF;

  -- Fallback to meeting owner if no assignee found
  IF assignee_user_id IS NULL THEN
    assignee_user_id := meeting_owner_id;
  END IF;

  -- Final check - must have a valid assignee
  IF assignee_user_id IS NULL THEN
    NEW.sync_status := 'failed';
    NEW.sync_error := 'No valid assignee found (no assignee email and no meeting owner)';
    RETURN NEW;
  END IF;

  -- Map Fathom priority to task priority
  task_priority := COALESCE(LOWER(NEW.priority), 'medium');
  IF task_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    task_priority := 'medium';
  END IF;

  BEGIN
    -- Create task
    INSERT INTO tasks (
      title,
      description,
      due_date,
      priority,
      status,
      task_type,
      assigned_to,
      created_by,
      meeting_action_item_id,
      notes,
      completed
    ) VALUES (
      NEW.title,
      CONCAT('Action item from meeting: ', COALESCE(meeting_title_text, 'Unknown Meeting')),
      COALESCE(NEW.deadline_at, NOW() + INTERVAL '3 days'),
      task_priority,
      CASE WHEN NEW.completed THEN 'completed' ELSE 'pending' END,
      'follow_up',
      assignee_user_id,
      assignee_user_id,
      NEW.id,
      CONCAT(
        'Category: ', COALESCE(NEW.category, 'General'),
        E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
        E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
      ),
      NEW.completed
    )
    RETURNING id INTO new_task_id;

    -- Update action item with sync status
    NEW.task_id := new_task_id;
    NEW.synced_to_task := true;
    NEW.sync_status := 'synced';
    NEW.synced_at := NOW();
    NEW.sync_error := NULL;

  EXCEPTION WHEN OTHERS THEN
    -- Handle errors gracefully
    NEW.sync_status := 'failed';
    NEW.sync_error := CONCAT('Error creating task: ', SQLERRM);
    NEW.synced_to_task := false;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new action items
DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;
CREATE TRIGGER trigger_auto_create_task_from_action_item
  BEFORE INSERT ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_task_from_action_item();

-- ============================================================================
-- PHASE 4: Bidirectional Sync - Task Completion to Action Item
-- ============================================================================

-- Sync task completion status to action item
CREATE OR REPLACE FUNCTION sync_task_completion_to_action_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if linked to action item
  IF NEW.meeting_action_item_id IS NOT NULL THEN
    UPDATE meeting_action_items
    SET
      completed = NEW.completed,
      updated_at = NOW()
    WHERE id = NEW.meeting_action_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_task_completion ON tasks;
CREATE TRIGGER trigger_sync_task_completion
  AFTER UPDATE OF completed ON tasks
  FOR EACH ROW
  WHEN (OLD.completed IS DISTINCT FROM NEW.completed)
  EXECUTE FUNCTION sync_task_completion_to_action_item();

-- ============================================================================
-- PHASE 5: Bidirectional Sync - Task Assignee to Action Item
-- ============================================================================

-- Sync task assignee changes to action item
CREATE OR REPLACE FUNCTION sync_task_assignee_to_action_item()
RETURNS TRIGGER AS $$
DECLARE
  new_assignee_email TEXT;
  new_assignee_name TEXT;
BEGIN
  -- Only sync if linked to action item
  IF NEW.meeting_action_item_id IS NOT NULL THEN
    -- Get new assignee details
    SELECT email, COALESCE(full_name, email) INTO new_assignee_email, new_assignee_name
    FROM auth.users
    WHERE id = NEW.assigned_to;

    -- Update action item with new assignee
    UPDATE meeting_action_items
    SET
      assignee_email = new_assignee_email,
      assignee_name = new_assignee_name,
      updated_at = NOW()
    WHERE id = NEW.meeting_action_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_task_assignee ON tasks;
CREATE TRIGGER trigger_sync_task_assignee
  AFTER UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION sync_task_assignee_to_action_item();

-- ============================================================================
-- PHASE 6: Bidirectional Sync - Action Item to Task
-- ============================================================================

-- Sync action item completion to task
CREATE OR REPLACE FUNCTION sync_action_item_completion_to_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if linked to task
  IF NEW.task_id IS NOT NULL THEN
    UPDATE tasks
    SET
      completed = NEW.completed,
      status = CASE
        WHEN NEW.completed THEN 'completed'
        ELSE 'pending'
      END,
      completed_at = CASE
        WHEN NEW.completed THEN NOW()
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_action_item_completion ON meeting_action_items;
CREATE TRIGGER trigger_sync_action_item_completion
  AFTER UPDATE OF completed ON meeting_action_items
  FOR EACH ROW
  WHEN (OLD.completed IS DISTINCT FROM NEW.completed)
  EXECUTE FUNCTION sync_action_item_completion_to_task();

-- ============================================================================
-- PHASE 7: Handle Task Deletion
-- ============================================================================

-- Handle task deletion - clear link in action item but keep the action item
CREATE OR REPLACE FUNCTION handle_task_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear the task link from action item
  IF OLD.meeting_action_item_id IS NOT NULL THEN
    UPDATE meeting_action_items
    SET
      task_id = NULL,
      synced_to_task = false,
      sync_status = 'pending',
      updated_at = NOW()
    WHERE id = OLD.meeting_action_item_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_task_deletion ON tasks;
CREATE TRIGGER trigger_handle_task_deletion
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_deletion();

-- ============================================================================
-- PHASE 8: Manual Sync Support Functions
-- ============================================================================

-- Function to manually sync a single action item to task
CREATE OR REPLACE FUNCTION sync_action_item_to_task(action_item_id UUID)
RETURNS JSON AS $$
DECLARE
  action_item RECORD;
  result JSON;
BEGIN
  -- Get the action item
  SELECT * INTO action_item
  FROM meeting_action_items
  WHERE id = action_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Action item not found'
    );
  END IF;

  -- Check if already synced
  IF action_item.task_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Action item already synced to task',
      'task_id', action_item.task_id
    );
  END IF;

  -- Trigger the sync by updating the record
  UPDATE meeting_action_items
  SET updated_at = NOW()
  WHERE id = action_item_id;

  -- Get the result
  SELECT
    json_build_object(
      'success', true,
      'task_id', mai.task_id,
      'sync_status', mai.sync_status,
      'sync_error', mai.sync_error
    ) INTO result
  FROM meeting_action_items mai
  WHERE mai.id = action_item_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to manually sync all action items for a meeting
CREATE OR REPLACE FUNCTION sync_meeting_action_items(p_meeting_id UUID)
RETURNS JSON AS $$
DECLARE
  synced_count INTEGER := 0;
  failed_count INTEGER := 0;
  excluded_count INTEGER := 0;
  already_synced_count INTEGER := 0;
BEGIN
  -- Count already synced
  SELECT COUNT(*) INTO already_synced_count
  FROM meeting_action_items
  WHERE meeting_id = p_meeting_id
    AND task_id IS NOT NULL;

  -- Update all pending action items to trigger sync
  UPDATE meeting_action_items
  SET updated_at = NOW()
  WHERE meeting_id = p_meeting_id
    AND task_id IS NULL;

  -- Count results
  SELECT
    COUNT(*) FILTER (WHERE sync_status = 'synced'),
    COUNT(*) FILTER (WHERE sync_status = 'failed'),
    COUNT(*) FILTER (WHERE sync_status = 'excluded')
  INTO synced_count, failed_count, excluded_count
  FROM meeting_action_items
  WHERE meeting_id = p_meeting_id;

  RETURN json_build_object(
    'success', true,
    'meeting_id', p_meeting_id,
    'synced', synced_count,
    'failed', failed_count,
    'excluded', excluded_count,
    'already_synced', already_synced_count
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 9: Add helpful comments
-- ============================================================================

COMMENT ON COLUMN tasks.meeting_action_item_id IS 'Link to Fathom meeting action item (bidirectional sync)';
COMMENT ON COLUMN meeting_action_items.task_id IS 'Link to CRM task (bidirectional sync)';
COMMENT ON COLUMN meeting_action_items.synced_to_task IS 'Whether this action item has been synced to a task';
COMMENT ON COLUMN meeting_action_items.sync_status IS 'Sync status: pending (not yet synced), synced (successfully synced), failed (sync error), excluded (external assignee)';
COMMENT ON COLUMN meeting_action_items.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN meeting_action_items.synced_at IS 'Timestamp when action item was synced to task';

COMMENT ON FUNCTION is_internal_assignee(TEXT) IS 'Check if email belongs to an internal user (sales rep vs external prospect)';
COMMENT ON FUNCTION get_user_id_from_email(TEXT) IS 'Get UUID for user by email address';
COMMENT ON FUNCTION auto_create_task_from_action_item() IS 'Automatically create CRM task when action item is created (for internal assignees only)';
COMMENT ON FUNCTION sync_task_completion_to_action_item() IS 'Bidirectional sync: Update action item when task completion changes';
COMMENT ON FUNCTION sync_task_assignee_to_action_item() IS 'Bidirectional sync: Update action item assignee when task assignee changes';
COMMENT ON FUNCTION sync_action_item_completion_to_task() IS 'Bidirectional sync: Update task when action item completion changes';
COMMENT ON FUNCTION handle_task_deletion() IS 'Clear action item link when task is deleted';
COMMENT ON FUNCTION sync_action_item_to_task(UUID) IS 'Manually trigger sync for a single action item';
COMMENT ON FUNCTION sync_meeting_action_items(UUID) IS 'Manually trigger sync for all action items in a meeting';
