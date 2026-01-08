-- Migration: RLS Policies for Action Items to Tasks Sync
-- Description: Ensure proper Row Level Security for meeting action items and tasks sync
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- Meeting Action Items RLS Policies
-- ============================================================================

-- Enable RLS on meeting_action_items if not already enabled
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view action items from their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can view their assigned action items" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can update their assigned action items" ON meeting_action_items;
DROP POLICY IF EXISTS "System can insert action items" ON meeting_action_items;

-- Policy: Users can view action items from meetings they own or attend
CREATE POLICY "Users can view action items from their meetings"
ON meeting_action_items
FOR SELECT
USING (
  -- User owns the meeting
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = auth.uid()
  )
  OR
  -- User is an attendee of the meeting
  EXISTS (
    SELECT 1
    FROM meeting_attendees ma
    JOIN meetings m ON m.id = ma.meeting_id
    WHERE ma.meeting_id = meeting_action_items.meeting_id
      AND ma.email IN (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
  )
  OR
  -- User is assigned to the action item
  assignee_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
);

-- Policy: Users can update action items assigned to them
CREATE POLICY "Users can update their assigned action items"
ON meeting_action_items
FOR UPDATE
USING (
  assignee_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
  OR
  -- Meeting owner can update action items
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  assignee_email IN (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = auth.uid()
  )
);

-- Policy: System can insert action items (for Fathom sync)
CREATE POLICY "System can insert action items"
ON meeting_action_items
FOR INSERT
WITH CHECK (
  -- Meeting owner can create action items
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_action_items.meeting_id
      AND m.owner_user_id = auth.uid()
  )
);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON meeting_action_items TO authenticated;
GRANT INSERT ON meeting_action_items TO authenticated, service_role;

-- ============================================================================
-- Tasks RLS Policies - Enhanced for Meeting Integration
-- ============================================================================

-- Ensure RLS is enabled on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for viewing tasks with meeting integration
DROP POLICY IF EXISTS "Users can view their tasks with meetings" ON tasks;

CREATE POLICY "Users can view their tasks with meetings"
ON tasks
FOR SELECT
USING (
  -- User is assigned to the task
  assigned_to = auth.uid()
  OR
  -- User created the task
  created_by = auth.uid()
  OR
  -- Task is linked to a deal the user owns
  deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  )
  OR
  -- Task is from a meeting action item the user can access
  meeting_action_item_id IN (
    SELECT mai.id
    FROM meeting_action_items mai
    JOIN meetings m ON m.id = mai.meeting_id
    WHERE m.owner_user_id = auth.uid()
       OR mai.assignee_email IN (
         SELECT email FROM auth.users WHERE id = auth.uid()
       )
  )
);

-- ============================================================================
-- Helper Function: Check if User Can Access Meeting Action Item
-- ============================================================================

CREATE OR REPLACE FUNCTION can_user_access_meeting_action_item(
  p_action_item_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM meeting_action_items mai
    JOIN meetings m ON m.id = mai.meeting_id
    WHERE mai.id = p_action_item_id
      AND (
        m.owner_user_id = p_user_id
        OR mai.assignee_email IN (
          SELECT email FROM auth.users WHERE id = p_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM meeting_attendees ma
          WHERE ma.meeting_id = mai.meeting_id
            AND ma.email IN (
              SELECT email FROM auth.users WHERE id = p_user_id
            )
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Helper Function: Check if Task is from Meeting
-- ============================================================================

CREATE OR REPLACE FUNCTION is_task_from_meeting(p_task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tasks
    WHERE id = p_task_id
      AND meeting_action_item_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Add Comments for Documentation
-- ============================================================================

COMMENT ON POLICY "Users can view action items from their meetings" ON meeting_action_items IS 'Users can view action items from meetings they own, attend, or are assigned to';
COMMENT ON POLICY "Users can update their assigned action items" ON meeting_action_items IS 'Users can update action items they are assigned to or from meetings they own';
COMMENT ON POLICY "System can insert action items" ON meeting_action_items IS 'Meeting owners can create action items';
COMMENT ON POLICY "Users can view their tasks with meetings" ON tasks IS 'Users can view tasks assigned to them, created by them, or linked to their meetings';

COMMENT ON FUNCTION can_user_access_meeting_action_item IS 'Check if a user has access to a specific meeting action item';
COMMENT ON FUNCTION is_task_from_meeting IS 'Check if a task was created from a meeting action item';

-- ============================================================================
-- Grant Function Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION can_user_access_meeting_action_item TO authenticated;
GRANT EXECUTE ON FUNCTION is_task_from_meeting TO authenticated;
