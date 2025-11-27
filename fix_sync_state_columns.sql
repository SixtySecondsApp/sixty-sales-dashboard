-- Fix fathom_sync_state columns to match edge function expectations

ALTER TABLE fathom_sync_state
  ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMPTZ;

ALTER TABLE fathom_sync_state
  ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ;

ALTER TABLE fathom_sync_state
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'fathom_sync_state'
ORDER BY ordinal_position;
