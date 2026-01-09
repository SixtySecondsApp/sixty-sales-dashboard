-- =============================================================================
-- Google Integration Token Status Enhancement
-- =============================================================================
-- Adds token_status and last_token_refresh columns to track token health
-- and enable proactive token refresh with proper error detection

-- Add token_status column to track token health
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_integrations' AND column_name = 'token_status'
  ) THEN
    ALTER TABLE google_integrations
    ADD COLUMN token_status TEXT DEFAULT 'valid'
    CHECK (token_status IN ('valid', 'expired', 'revoked', 'needs_reconnect'));

    COMMENT ON COLUMN google_integrations.token_status IS
      'Token health status: valid, expired, revoked, needs_reconnect';
  END IF;
END $$;

-- Add last_token_refresh column to track when token was last refreshed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'google_integrations' AND column_name = 'last_token_refresh'
  ) THEN
    ALTER TABLE google_integrations
    ADD COLUMN last_token_refresh TIMESTAMPTZ;

    COMMENT ON COLUMN google_integrations.last_token_refresh IS
      'Timestamp of last successful token refresh';
  END IF;
END $$;

-- Create index for finding integrations that need attention
CREATE INDEX IF NOT EXISTS idx_google_integrations_token_status
  ON google_integrations(token_status)
  WHERE token_status != 'valid';

-- Create index for finding stale tokens (not refreshed recently)
CREATE INDEX IF NOT EXISTS idx_google_integrations_last_refresh
  ON google_integrations(last_token_refresh)
  WHERE is_active = true;

-- Update existing integrations to have 'valid' status if they're active
UPDATE google_integrations
SET token_status = 'valid'
WHERE is_active = true AND token_status IS NULL;

-- Mark inactive integrations appropriately
UPDATE google_integrations
SET token_status = 'needs_reconnect'
WHERE is_active = false AND token_status IS NULL;

COMMENT ON TABLE google_integrations IS
  'Google OAuth integrations with token health tracking for proactive refresh';
