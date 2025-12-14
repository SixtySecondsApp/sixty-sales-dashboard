-- Add missing Fathom sync columns to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS fathom_user_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('synced', 'syncing', 'error'));

-- Create index for fathom_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_user_id ON meetings(fathom_user_id);

-- Create index for sync_status
CREATE INDEX IF NOT EXISTS idx_meetings_sync_status ON meetings(sync_status);

-- Add comment to document these fields
COMMENT ON COLUMN meetings.fathom_user_id IS 'Fathom user ID from the Fathom API';
COMMENT ON COLUMN meetings.last_synced_at IS 'Timestamp of last sync from Fathom API';
COMMENT ON COLUMN meetings.sync_status IS 'Current sync status: synced, syncing, or error';
