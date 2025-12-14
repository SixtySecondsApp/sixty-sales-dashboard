-- Migration: Add columns for syncing tasks between meeting_action_items and tasks tables
-- Purpose: Enable bidirectional sync and proper categorization of Fathom-generated tasks

-- ============================================
-- PART 1: Add missing columns to meeting_action_items
-- ============================================

-- Add linked_task_id to track which task in the tasks table corresponds to this action item
ALTER TABLE meeting_action_items 
ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Add is_sales_rep_task to distinguish between sales rep and prospect tasks
ALTER TABLE meeting_action_items 
ADD COLUMN IF NOT EXISTS is_sales_rep_task BOOLEAN DEFAULT false;

-- Create index for performance when looking up by linked task
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_linked_task_id 
ON meeting_action_items(linked_task_id) 
WHERE linked_task_id IS NOT NULL;

-- ============================================
-- PART 2: Add missing columns to tasks table
-- ============================================

-- Add meeting_id to link tasks to their source meeting
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- Add meeting_action_item_id to link back to the source action item
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS meeting_action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE SET NULL;

-- Add category column to store the task category from Fathom
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id 
ON tasks(meeting_id) 
WHERE meeting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_meeting_action_item_id 
ON tasks(meeting_action_item_id) 
WHERE meeting_action_item_id IS NOT NULL;

-- ============================================
-- PART 3: Create bidirectional sync triggers
-- ============================================

-- Function to sync task completion to meeting_action_items
CREATE OR REPLACE FUNCTION sync_task_completion_to_action_item()
RETURNS TRIGGER AS $$
BEGIN
  -- When a task's completed status changes, update the linked action item
  IF NEW.meeting_action_item_id IS NOT NULL AND 
     OLD.completed IS DISTINCT FROM NEW.completed THEN
    UPDATE meeting_action_items 
    SET 
      completed = NEW.completed,
      updated_at = NOW()
    WHERE id = NEW.meeting_action_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync action item completion to tasks
CREATE OR REPLACE FUNCTION sync_action_item_completion_to_task()
RETURNS TRIGGER AS $$
BEGIN
  -- When an action item's completed status changes, update the linked task
  IF NEW.linked_task_id IS NOT NULL AND 
     OLD.completed IS DISTINCT FROM NEW.completed THEN
    UPDATE tasks 
    SET 
      completed = NEW.completed,
      completed_at = CASE 
        WHEN NEW.completed = true THEN NOW() 
        ELSE NULL 
      END,
      status = CASE 
        WHEN NEW.completed = true THEN 'completed'::text
        ELSE 'pending'::text
      END,
      updated_at = NOW()
    WHERE id = NEW.linked_task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_task_completion ON tasks;

DROP TRIGGER IF EXISTS sync_action_item_completion ON meeting_action_items;

-- Create trigger on tasks table
CREATE TRIGGER sync_task_completion
  AFTER UPDATE OF completed ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_task_completion_to_action_item();

-- Create trigger on meeting_action_items table  
CREATE TRIGGER sync_action_item_completion
  AFTER UPDATE OF completed ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION sync_action_item_completion_to_task();

-- ============================================
-- PART 4: Update existing data (if any)
-- ============================================

-- Mark existing action items as sales rep tasks if they have certain characteristics
UPDATE meeting_action_items
SET is_sales_rep_task = true
WHERE (
  assignee_email LIKE '%@sixtyseconds.video' OR
  category IN ('Call', 'Email', 'Proposal', 'Send Information', 'LinkedIn Message', 'LinkedIn Connection') OR
  assignee_email IS NULL
) AND is_sales_rep_task IS NULL;

-- Mark prospect tasks
UPDATE meeting_action_items
SET is_sales_rep_task = false
WHERE 
  assignee_email NOT LIKE '%@sixtyseconds.video' AND
  assignee_email IS NOT NULL AND
  assignee_email LIKE '%@%' AND
  is_sales_rep_task IS NULL;

-- ============================================
-- PART 5: Add RLS policies for new columns
-- ============================================

-- Ensure RLS is enabled on both tables
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Meeting action items should be viewable based on meeting ownership
DROP POLICY IF EXISTS "Users can view meeting action items" ON meeting_action_items;

CREATE POLICY "Users can view meeting action items" ON meeting_action_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Users can update their own meeting action items
DROP POLICY IF EXISTS "Users can update meeting action items" ON meeting_action_items;

CREATE POLICY "Users can update meeting action items" ON meeting_action_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  -- Verify columns were added
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meeting_action_items' 
    AND column_name = 'linked_task_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add linked_task_id column to meeting_action_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' 
    AND column_name = 'meeting_id'
  ) THEN
    RAISE EXCEPTION 'Failed to add meeting_id column to tasks';
  END IF;

  RAISE NOTICE '✅ Task sync columns and triggers created successfully!';
END $$;\n
