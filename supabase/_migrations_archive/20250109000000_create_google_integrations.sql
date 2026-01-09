-- Migration: Create Google Integrations Table
-- Purpose: Core table for Google OAuth integration storage
-- Note: This table was created before migration tracking; adding for staging branch compatibility

CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one integration per user per email
  UNIQUE(user_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON google_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_google_integrations_email ON google_integrations(email);
CREATE INDEX IF NOT EXISTS idx_google_integrations_is_active ON google_integrations(is_active) WHERE is_active = true;

-- Enable RLS (policies will be added in later migration)
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policy for user access (will be updated to org-based in later migration)
CREATE POLICY "Users can view their own google integrations"
  ON google_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own google integrations"
  ON google_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google integrations"
  ON google_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own google integrations"
  ON google_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_google_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_google_integrations_updated_at ON google_integrations;
CREATE TRIGGER update_google_integrations_updated_at
  BEFORE UPDATE ON google_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_google_integrations_updated_at();

-- Grant permissions
GRANT ALL ON google_integrations TO authenticated;

-- Comments
COMMENT ON TABLE google_integrations IS 'Stores Google OAuth integration credentials for calendar and docs access';
COMMENT ON COLUMN google_integrations.access_token IS 'Google OAuth access token';
COMMENT ON COLUMN google_integrations.refresh_token IS 'Google OAuth refresh token for token renewal';
COMMENT ON COLUMN google_integrations.scopes IS 'OAuth scopes granted by user';
COMMENT ON COLUMN google_integrations.is_active IS 'Whether integration is currently active';
