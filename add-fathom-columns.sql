-- Add missing Fathom sync columns to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS fathom_user_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('synced', 'syncing', 'error'));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_user_id ON meetings(fathom_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_sync_status ON meetings(sync_status);
