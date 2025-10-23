-- Migration: Create Fathom OAuth Integration Tables
-- Purpose: Store OAuth tokens and sync state for Fathom API integration
-- Date: 2025-01-24

-- ============================================================================
-- 1. Create fathom_integrations table for OAuth tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS fathom_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth Tokens (Note: Supabase doesn't have native ENCRYPTED type,
  -- we'll handle encryption in Edge Functions using pgsodium if needed)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Fathom User Info
  fathom_user_id TEXT,
  fathom_user_email TEXT,

  -- OAuth Scopes
  scopes TEXT[] DEFAULT ARRAY['calls:read', 'analytics:read', 'highlights:write'],

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id),
  UNIQUE(fathom_user_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_fathom_integrations_user_id
  ON fathom_integrations(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fathom_integrations_fathom_user_id
  ON fathom_integrations(fathom_user_id);

-- ============================================================================
-- 2. Create fathom_sync_state table for tracking sync progress
-- ============================================================================

CREATE TABLE IF NOT EXISTS fathom_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES fathom_integrations(id) ON DELETE CASCADE,

  -- Sync Status
  last_successful_sync TIMESTAMPTZ,
  cursor_position TEXT, -- For pagination in Fathom API
  sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'syncing', 'error')),

  -- Error Tracking
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,

  -- Metrics
  meetings_synced INTEGER DEFAULT 0,
  total_meetings_found INTEGER DEFAULT 0,

  -- Sync Configuration
  sync_date_range_start TIMESTAMPTZ,
  sync_date_range_end TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id),
  UNIQUE(integration_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_fathom_sync_state_user_id
  ON fathom_sync_state(user_id);

CREATE INDEX IF NOT EXISTS idx_fathom_sync_state_integration_id
  ON fathom_sync_state(integration_id);

CREATE INDEX IF NOT EXISTS idx_fathom_sync_state_status
  ON fathom_sync_state(sync_status)
  WHERE sync_status = 'syncing';

-- ============================================================================
-- 3. Update meetings table for Fathom API integration
-- ============================================================================

-- Add columns if they don't exist
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS fathom_user_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending', 'error'));

-- Create index for Fathom user lookups
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_user_id
  ON meetings(fathom_user_id)
  WHERE fathom_user_id IS NOT NULL;

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_meetings_sync_status
  ON meetings(sync_status)
  WHERE sync_status != 'synced';

-- ============================================================================
-- 4. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE fathom_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fathom_sync_state ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. Create RLS Policies for fathom_integrations
-- ============================================================================

-- Users can view their own integration
CREATE POLICY "Users can view their own Fathom integration"
  ON fathom_integrations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own integration
CREATE POLICY "Users can insert their own Fathom integration"
  ON fathom_integrations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own integration
CREATE POLICY "Users can update their own Fathom integration"
  ON fathom_integrations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own integration
CREATE POLICY "Users can delete their own Fathom integration"
  ON fathom_integrations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can manage all integrations (for Edge Functions)
CREATE POLICY "Service role can manage all Fathom integrations"
  ON fathom_integrations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 6. Create RLS Policies for fathom_sync_state
-- ============================================================================

-- Users can view their own sync state
CREATE POLICY "Users can view their own Fathom sync state"
  ON fathom_sync_state
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sync state
CREATE POLICY "Users can insert their own Fathom sync state"
  ON fathom_sync_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sync state
CREATE POLICY "Users can update their own Fathom sync state"
  ON fathom_sync_state
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can manage all sync states (for Edge Functions)
CREATE POLICY "Service role can manage all Fathom sync states"
  ON fathom_sync_state
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 7. Create function to update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_fathom_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Create triggers for updated_at
-- ============================================================================

CREATE TRIGGER update_fathom_integrations_updated_at
  BEFORE UPDATE ON fathom_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_fathom_updated_at();

CREATE TRIGGER update_fathom_sync_state_updated_at
  BEFORE UPDATE ON fathom_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_fathom_updated_at();

-- ============================================================================
-- 9. Create helper function to get active integration for user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_fathom_integration(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  fathom_user_id TEXT,
  fathom_user_email TEXT,
  scopes TEXT[],
  last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.id,
    fi.user_id,
    fi.access_token,
    fi.refresh_token,
    fi.token_expires_at,
    fi.fathom_user_id,
    fi.fathom_user_email,
    fi.scopes,
    fi.last_sync_at
  FROM fathom_integrations fi
  WHERE fi.user_id = p_user_id
    AND fi.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. Grant permissions
-- ============================================================================

-- Grant execute on helper function to authenticated users
GRANT EXECUTE ON FUNCTION get_active_fathom_integration(UUID) TO authenticated;

-- Grant execute on update function to postgres (for triggers)
GRANT EXECUTE ON FUNCTION update_fathom_updated_at() TO postgres;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON TABLE fathom_integrations IS 'Stores OAuth tokens and connection status for Fathom API integration';
COMMENT ON TABLE fathom_sync_state IS 'Tracks sync progress and status for each user Fathom integration';
COMMENT ON COLUMN meetings.fathom_user_id IS 'Fathom user ID who owns this meeting (for multi-user support)';
COMMENT ON COLUMN meetings.last_synced_at IS 'Timestamp of last successful sync from Fathom API';
COMMENT ON COLUMN meetings.sync_status IS 'Current sync status of this meeting';
