-- Create bidirectional sync triggers for tasks and meeting_action_items
-- Run this in Supabase SQL Editor after running the column migration

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

-- Test the triggers by checking if they were created
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger 
JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid
WHERE tgname IN ('sync_task_completion', 'sync_action_item_completion');