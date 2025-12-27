-- Migration: Create JustCall OAuth State Tracking Table
-- Purpose: Store OAuth state parameters for CSRF protection (org-scoped)
-- Date: 2025-12-13

CREATE TABLE IF NOT EXISTS justcall_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_justcall_oauth_states_state
  ON justcall_oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_justcall_oauth_states_org_id
  ON justcall_oauth_states(org_id);

CREATE OR REPLACE FUNCTION cleanup_expired_justcall_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM justcall_oauth_states
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE justcall_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_manage_justcall_oauth_states" ON justcall_oauth_states;
CREATE POLICY "service_role_manage_justcall_oauth_states"
  ON justcall_oauth_states
  FOR ALL
  USING (public.is_service_role())
  WITH CHECK (public.is_service_role());

GRANT EXECUTE ON FUNCTION cleanup_expired_justcall_oauth_states() TO service_role;

COMMENT ON TABLE justcall_oauth_states IS 'Temporary storage for JustCall OAuth state parameters (CSRF protection)';
COMMENT ON COLUMN justcall_oauth_states.state IS 'Random state parameter for OAuth flow';
COMMENT ON COLUMN justcall_oauth_states.expires_at IS 'When this state expires (typically 10 minutes)';











