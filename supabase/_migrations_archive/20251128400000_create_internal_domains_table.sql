-- Internal Email Domains Table
-- Stores which email domains are considered "internal" for user type detection
-- This replaces the hardcoded INTERNAL_DOMAINS array in the frontend

-- ============================================================================
-- INTERNAL EMAIL DOMAINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS internal_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add index for domain lookups
CREATE INDEX IF NOT EXISTS idx_internal_domains_domain ON internal_email_domains(domain);
CREATE INDEX IF NOT EXISTS idx_internal_domains_active ON internal_email_domains(is_active) WHERE is_active = true;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_internal_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_internal_domains_updated_at ON internal_email_domains;
CREATE TRIGGER set_internal_domains_updated_at
  BEFORE UPDATE ON internal_email_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_internal_domains_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE internal_email_domains ENABLE ROW LEVEL SECURITY;

-- Only admins can manage internal domains
-- But the list can be read by authenticated users (for checking their own status)
CREATE POLICY "Anyone authenticated can read internal domains"
  ON internal_email_domains FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert internal domains"
  ON internal_email_domains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

CREATE POLICY "Only admins can update internal domains"
  ON internal_email_domains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

CREATE POLICY "Only admins can delete internal domains"
  ON internal_email_domains FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- ============================================================================
-- SEED DEFAULT DOMAIN
-- ============================================================================
INSERT INTO internal_email_domains (domain, description, is_active)
VALUES ('sixtyseconds.video', 'Sixty Seconds team - primary internal domain', true)
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION: Check if email is internal
-- ============================================================================
CREATE OR REPLACE FUNCTION is_internal_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM internal_email_domains
    WHERE is_active = true
    AND email ILIKE '%@' || domain
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_internal_email(TEXT) TO authenticated;
