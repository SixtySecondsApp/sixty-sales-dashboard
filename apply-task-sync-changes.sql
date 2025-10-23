-- Simple migration script to add task sync columns
-- Run this in the Supabase SQL Editor

-- Add columns to meeting_action_items
ALTER TABLE meeting_action_items 
ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_sales_rep_task BOOLEAN DEFAULT false;

-- Add columns to tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS meeting_action_item_id UUID REFERENCES meeting_action_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_linked_task_id ON meeting_action_items(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_action_item_id ON tasks(meeting_action_item_id);