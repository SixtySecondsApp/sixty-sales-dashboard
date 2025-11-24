-- Create user_sync_status table for tracking Google Calendar and Gmail sync state
-- This table tracks incremental sync tokens and last sync times at the user level

CREATE TABLE IF NOT EXISTS user_sync_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Calendar sync tracking
  calendar_last_synced_at TIMESTAMPTZ,
  calendar_sync_token TEXT, -- Google Calendar incremental sync token
  
  -- Email sync tracking (for future Gmail sync)
  email_last_synced_at TIMESTAMPTZ,
  email_sync_token TEXT, -- Gmail historyId for incremental sync
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add synced_at column to calendar_events if it doesn't exist
-- This tracks when each event was last synced from Google Calendar
ALTER TABLE calendar_events 
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure the index on external_id and user_id exists (may already exist from previous migration)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external_id_user 
  ON calendar_events(user_id, external_id) 
  WHERE external_id IS NOT NULL;

-- Index for sync queries
CREATE INDEX IF NOT EXISTS idx_user_sync_status_calendar_synced 
  ON user_sync_status(calendar_last_synced_at) 
  WHERE calendar_last_synced_at IS NOT NULL;

-- Enable RLS
ALTER TABLE user_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own sync status" ON user_sync_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync status" ON user_sync_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert sync status" ON user_sync_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_user_sync_status_timestamp
  BEFORE UPDATE ON user_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sync_status_updated_at();

-- Comments
COMMENT ON TABLE user_sync_status IS 'Tracks Google Calendar and Gmail sync state per user for incremental synchronization';
COMMENT ON COLUMN user_sync_status.calendar_sync_token IS 'Google Calendar syncToken for incremental sync - use this to fetch only changed events';
COMMENT ON COLUMN user_sync_status.email_sync_token IS 'Gmail historyId for incremental email sync (future use)';
COMMENT ON COLUMN calendar_events.synced_at IS 'Timestamp when this event was last synced from Google Calendar';



