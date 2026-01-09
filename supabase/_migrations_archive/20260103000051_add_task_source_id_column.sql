-- Migration: Add source_id column to tasks table
-- Description: Enable tasks to reference their source record
-- Date: 2026-01-03

-- Add source_id column to tasks table (source column already exists)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_id UUID;

-- Create index for source_id lookups
CREATE INDEX IF NOT EXISTS idx_tasks_source_id ON tasks(source_id) WHERE source_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN tasks.source_id IS 'UUID of the source record (voice_recording.id, meeting.id, etc.)';
