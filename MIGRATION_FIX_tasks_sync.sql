-- Fixed version of 20251025200000_fathom_action_items_tasks_sync.sql
-- Fix: Added missing task_id column to meeting_action_items table
-- Original migration referenced task_id in index but never created the column

-- Migration: Fathom Action Items to Tasks Sync System
-- Description: Enable bidirectional sync between meeting action items and CRM tasks

-- ============================================================================
-- PHASE 1: Schema Updates
-- ============================================================================

-- Add reverse lookup column to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS meeting_action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE SET NULL;

-- Add sync tracking fields to meeting_action_items
ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- FIXED: Added missing column!
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
  WHERE email = email_input;

  RETURN user_uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PHASE 3: Sync Functions
-- ============================================================================

-- Function to sync meeting action item to task
CREATE OR REPLACE FUNCTION sync_action_item_to_task(action_item_id UUID)
RETURNS UUID AS $$
DECLARE
  v_action_item RECORD;
  v_user_id UUID;
  v_task_id UUID;
  v_meeting_owner_id UUID;
  v_company_id UUID;
  v_deal_id UUID;
BEGIN
  -- Get action item details
  SELECT * INTO v_action_item
  FROM meeting_action_items
  WHERE id = action_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action item not found: %', action_item_id;
  END IF;

  -- Get meeting owner and company
  SELECT owner_user_id, company_id INTO v_meeting_owner_id, v_company_id
  FROM meetings
  WHERE id = v_action_item.meeting_id;

  -- Get active deal for this company
  -- FIXED: deals table uses 'status' not 'stage'
  SELECT id INTO v_deal_id
  FROM deals
  WHERE company_id = v_company_id
    AND status = 'active' -- Only active deals, not won/lost
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if assignee is internal (sales rep)
  IF NOT is_internal_assignee(v_action_item.assignee_email) THEN
    -- External assignee - mark as excluded
    UPDATE meeting_action_items
    SET
      sync_status = 'excluded',
      sync_error = 'External assignee - not synced to CRM tasks'
    WHERE id = action_item_id;

    RETURN NULL;
  END IF;

  -- Get user ID for internal assignee
  v_user_id := get_user_id_from_email(v_action_item.assignee_email);

  IF v_user_id IS NULL THEN
    UPDATE meeting_action_items
    SET
      sync_status = 'failed',
      sync_error = 'Could not find user ID for email: ' || v_action_item.assignee_email
    WHERE id = action_item_id;

    RETURN NULL;
  END IF;

  -- Check if task already exists
  IF v_action_item.task_id IS NOT NULL THEN
    -- Update existing task
    UPDATE tasks
    SET
      title = v_action_item.title,
      description = NULL, -- meeting_action_items has no notes field
      priority = CASE
        WHEN v_action_item.priority = 'high' THEN 'high'
        WHEN v_action_item.priority = 'medium' THEN 'medium'
        ELSE 'low'
      END,
      due_date = v_action_item.deadline_at, -- FIXED: deadline_at not due_date
      status = CASE
        WHEN v_action_item.completed THEN 'completed'
        ELSE 'open'
      END,
      updated_at = NOW()
    WHERE id = v_action_item.task_id;

    v_task_id := v_action_item.task_id;
  ELSE
    -- Create new task
    INSERT INTO tasks (
      title,
      description,
      created_by,
      assigned_to,
      company_id,
      deal_id,
      priority,
      due_date,
      status,
      task_type,
      meeting_action_item_id,
      created_at,
      updated_at
    ) VALUES (
      v_action_item.title,
      NULL, -- meeting_action_items has no notes field
      v_meeting_owner_id, -- creator is meeting owner
      v_user_id, -- assigned to the action item assignee
      v_company_id,
      v_deal_id,
      CASE
        WHEN v_action_item.priority = 'high' THEN 'high'
        WHEN v_action_item.priority = 'medium' THEN 'medium'
        ELSE 'low'
      END,
      v_action_item.deadline_at, -- FIXED: deadline_at not due_date
      CASE
        WHEN v_action_item.completed THEN 'completed'
        ELSE 'open'
      END,
      'follow_up',
      action_item_id,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_task_id;

    -- Update action item with task reference
    UPDATE meeting_action_items
    SET task_id = v_task_id
    WHERE id = action_item_id;
  END IF;

  -- Mark as synced
  UPDATE meeting_action_items
  SET
    synced_to_task = true,
    sync_status = 'synced',
    sync_error = NULL,
    synced_at = NOW()
  WHERE id = action_item_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to sync task changes back to action item
CREATE OR REPLACE FUNCTION sync_task_to_action_item(task_id_input UUID)
RETURNS UUID AS $$
DECLARE
  v_task RECORD;
  v_action_item_id UUID;
BEGIN
  -- Get task details
  SELECT * INTO v_task
  FROM tasks
  WHERE id = task_id_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found: %', task_id_input;
  END IF;

  -- Get linked action item
  v_action_item_id := v_task.meeting_action_item_id;

  IF v_action_item_id IS NULL THEN
    -- Task not linked to action item
    RETURN NULL;
  END IF;

  -- Update action item
  UPDATE meeting_action_items
  SET
    title = v_task.title,
    -- No notes field in meeting_action_items
    priority = CASE
      WHEN v_task.priority = 'high' THEN 'high'
      WHEN v_task.priority = 'medium' THEN 'medium'
      ELSE 'low'
    END,
    deadline_at = v_task.due_date, -- FIXED: deadline_at not due_date
    completed = (v_task.status = 'completed'),
    updated_at = NOW()
  WHERE id = v_action_item_id;

  RETURN v_action_item_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 4: Triggers for Automatic Sync
-- ============================================================================

-- Trigger to sync action items to tasks when they're created or updated
CREATE OR REPLACE FUNCTION trigger_sync_action_item_to_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if assignee is internal (checked in sync function)
  PERFORM sync_action_item_to_task(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_action_item_on_insert ON meeting_action_items;
CREATE TRIGGER sync_action_item_on_insert
  AFTER INSERT ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_action_item_to_task();

DROP TRIGGER IF EXISTS sync_action_item_on_update ON meeting_action_items;
CREATE TRIGGER sync_action_item_on_update
  AFTER UPDATE ON meeting_action_items
  FOR EACH ROW
  WHEN (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.deadline_at IS DISTINCT FROM NEW.deadline_at OR -- FIXED: deadline_at not due_date
    OLD.completed IS DISTINCT FROM NEW.completed OR
    OLD.assignee_email IS DISTINCT FROM NEW.assignee_email
  )
  EXECUTE FUNCTION trigger_sync_action_item_to_task();

-- Trigger to sync task changes back to action items
CREATE OR REPLACE FUNCTION trigger_sync_task_to_action_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.meeting_action_item_id IS NOT NULL THEN
    PERFORM sync_task_to_action_item(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_task_on_update ON tasks;
CREATE TRIGGER sync_task_on_update
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.priority IS DISTINCT FROM NEW.priority OR
    OLD.due_date IS DISTINCT FROM NEW.due_date OR
    OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION trigger_sync_task_to_action_item();

-- ============================================================================
-- PHASE 5: Comments and Documentation
-- ============================================================================

COMMENT ON COLUMN tasks.meeting_action_item_id IS 'Link to source meeting action item for bidirectional sync';
COMMENT ON COLUMN meeting_action_items.task_id IS 'Link to synced CRM task (for internal assignees only)';
COMMENT ON COLUMN meeting_action_items.synced_to_task IS 'Whether this action item has been synced to a CRM task';
COMMENT ON COLUMN meeting_action_items.sync_status IS 'Sync status: pending, synced, failed, or excluded (external assignee)';
COMMENT ON COLUMN meeting_action_items.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN meeting_action_items.synced_at IS 'When this action item was last synced';

-- Note: meeting_action_items table has no notes/description field
-- Syncing only handles: title, priority, deadline_at, completed, assignee_email

COMMENT ON FUNCTION sync_action_item_to_task IS 'Syncs a meeting action item to a CRM task (internal assignees only)';
COMMENT ON FUNCTION sync_task_to_action_item IS 'Syncs task changes back to the source action item';
COMMENT ON FUNCTION is_internal_assignee IS 'Checks if an email belongs to an internal user (sales rep)';
COMMENT ON FUNCTION get_user_id_from_email IS 'Gets user UUID from email address';

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_action_item_to_task TO authenticated;
GRANT EXECUTE ON FUNCTION sync_task_to_action_item TO authenticated;
GRANT EXECUTE ON FUNCTION is_internal_assignee TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_from_email TO authenticated;
