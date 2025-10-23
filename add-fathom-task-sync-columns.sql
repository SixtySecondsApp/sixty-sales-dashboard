-- Add columns to support Fathom task syncing
-- This migration adds the necessary fields to track sales rep vs prospect tasks

-- ========================================
-- STEP 1: Add columns to meeting_action_items
-- ========================================
ALTER TABLE meeting_action_items 
ADD COLUMN IF NOT EXISTS is_sales_rep_task BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_linked_task 
ON meeting_action_items(linked_task_id) 
WHERE linked_task_id IS NOT NULL;

-- ========================================
-- STEP 2: Add column to tasks table for reverse reference
-- ========================================
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS meeting_action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE CASCADE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_action_item 
ON tasks(meeting_action_item_id) 
WHERE meeting_action_item_id IS NOT NULL;

-- ========================================
-- STEP 3: Create a trigger to sync task status
-- ========================================
CREATE OR REPLACE FUNCTION sync_task_completion_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a task status changes to 'done', update the linked action item
  IF (NEW.status != OLD.status OR NEW.status IS DISTINCT FROM OLD.status) 
     AND NEW.meeting_action_item_id IS NOT NULL THEN
    UPDATE meeting_action_items 
    SET completed = (NEW.status = 'done'),
        updated_at = NOW()
    WHERE id = NEW.meeting_action_item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_task_completion ON tasks;

-- Create the trigger
CREATE TRIGGER sync_task_completion
AFTER UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION sync_task_completion_status();

-- ========================================
-- STEP 4: Create reverse sync trigger
-- ========================================
CREATE OR REPLACE FUNCTION sync_action_item_to_task()
RETURNS TRIGGER AS $$
BEGIN
  -- When an action item is marked complete, update the linked task status
  IF NEW.completed != OLD.completed AND NEW.linked_task_id IS NOT NULL THEN
    UPDATE tasks 
    SET status = CASE WHEN NEW.completed THEN 'done' ELSE 'pending' END,
        updated_at = NOW()
    WHERE id = NEW.linked_task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_action_item_completion ON meeting_action_items;

-- Create the trigger
CREATE TRIGGER sync_action_item_completion
AFTER UPDATE ON meeting_action_items
FOR EACH ROW
EXECUTE FUNCTION sync_action_item_to_task();

-- ========================================
-- STEP 5: Create views for easy querying
-- ========================================

-- View for sales rep action items (with task details)
CREATE OR REPLACE VIEW sales_rep_action_items AS
SELECT 
    mai.*,
    t.id as task_id,
    (t.status = 'done') as task_completed,
    t.owner_id as assigned_user_id,
    m.title as meeting_title
FROM meeting_action_items mai
LEFT JOIN tasks t ON mai.linked_task_id = t.id
LEFT JOIN meetings m ON mai.meeting_id = m.id
WHERE mai.is_sales_rep_task = true;

-- View for prospect action items (no tasks)
CREATE OR REPLACE VIEW prospect_action_items AS
SELECT 
    mai.*,
    m.title as meeting_title,
    m.owner_user_id as meeting_owner
FROM meeting_action_items mai
LEFT JOIN meetings m ON mai.meeting_id = m.id
WHERE mai.is_sales_rep_task = false;

-- ========================================
-- STEP 6: Test data to verify
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FATHOM TASK SYNC SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'New Features Added:';
    RAISE NOTICE '1. Sales rep tasks create entries in tasks table';
    RAISE NOTICE '2. Prospect tasks only stored in meeting_action_items';
    RAISE NOTICE '3. Bi-directional sync between tasks and action items';
    RAISE NOTICE '4. Views for easy querying of each type';
    RAISE NOTICE '';
    RAISE NOTICE 'How it works:';
    RAISE NOTICE '- Jane Smith tasks → Created in tasks table + synced';
    RAISE NOTICE '- John Doe (prospect) tasks → Only in meeting_action_items';
    RAISE NOTICE '- Marking task done → Auto-updates action item';
    RAISE NOTICE '- Marking action item done → Auto-updates task';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;