-- Migration: Create OAuth State Tracking Table
-- Purpose: Store OAuth state parameters for CSRF protection
-- Date: 2025-01-24

-- ============================================================================
-- 1. Create fathom_oauth_states table
-- ============================================================================

CREATE TABLE IF NOT EXISTS fathom_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups (without immutability issue)
CREATE INDEX IF NOT EXISTS idx_fathom_oauth_states_state
  ON fathom_oauth_states(state);

CREATE INDEX IF NOT EXISTS idx_fathom_oauth_states_user_id
  ON fathom_oauth_states(user_id);

-- ============================================================================
-- 2. Create cleanup function for expired states
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_fathom_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM fathom_oauth_states
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Enable Row Level Security
-- ============================================================================

ALTER TABLE fathom_oauth_states ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Create RLS Policies
-- ============================================================================

-- Service role can manage all OAuth states (for Edge Functions)
CREATE POLICY "Service role can manage OAuth states"
  ON fathom_oauth_states
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION cleanup_expired_fathom_oauth_states() TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON TABLE fathom_oauth_states IS 'Temporary storage for OAuth state parameters (CSRF protection)';
COMMENT ON COLUMN fathom_oauth_states.state IS 'Random state parameter for OAuth flow';
COMMENT ON COLUMN fathom_oauth_states.expires_at IS 'When this state expires (typically 10 minutes)';
