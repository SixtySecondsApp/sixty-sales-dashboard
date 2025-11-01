-- Quick fix: Add missing columns to tasks table
-- Run this in Supabase Dashboard > SQL Editor

-- Add source column to track task origin
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS source TEXT;

-- Add metadata column for structured data storage
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add meeting_id column for direct meeting association
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- Add index for metadata queries (particularly for action_item_id lookups)
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_action_item
ON tasks USING gin ((metadata->'action_item_id'))
WHERE metadata IS NOT NULL;

-- Add index for faster lookups by source
CREATE INDEX IF NOT EXISTS idx_tasks_source
ON tasks(source)
WHERE source IS NOT NULL;

-- Add index for meeting_id
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id
ON tasks(meeting_id)
WHERE meeting_id IS NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN tasks.source IS 'Origin of the task: fathom_action_item, manual, automated, etc.';
COMMENT ON COLUMN tasks.metadata IS 'Stores additional structured data: action_item_id (UUID), fathom_meeting_id (UUID), recording_timestamp (INTEGER), recording_playback_url (TEXT)';
COMMENT ON COLUMN tasks.meeting_id IS 'Direct reference to the associated meeting (if task was created from a meeting)';

-- Verify the columns were added
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('source', 'metadata', 'meeting_id')
ORDER BY column_name;
