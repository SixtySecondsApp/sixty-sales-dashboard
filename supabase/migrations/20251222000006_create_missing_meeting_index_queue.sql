-- Add missing columns to meeting_index_queue if they don't exist
-- The table exists but may be missing columns

ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE meeting_index_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
