-- ============================================================================
-- Waitlist Invite Codes System
-- Gates waitlist signups behind access codes for controlled rollout
-- ============================================================================

-- Create waitlist_invite_codes table
CREATE TABLE IF NOT EXISTS waitlist_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The invite code (case-insensitive, stored as provided)
  code TEXT NOT NULL UNIQUE,

  -- Descriptive label for admin reference
  description TEXT,

  -- Is this code currently active?
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Usage tracking (unlimited uses by default)
  use_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case-insensitive unique index for lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_invite_codes_upper
ON waitlist_invite_codes(UPPER(code));

-- Index for active codes lookup
CREATE INDEX IF NOT EXISTS idx_waitlist_invite_codes_active
ON waitlist_invite_codes(is_active) WHERE is_active = true;

-- Auto-update timestamp trigger
CREATE TRIGGER update_waitlist_invite_codes_timestamp
BEFORE UPDATE ON waitlist_invite_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE waitlist_invite_codes ENABLE ROW LEVEL SECURITY;

-- Public can validate codes (SELECT only)
CREATE POLICY "Public can validate invite codes"
ON waitlist_invite_codes FOR SELECT
TO public
USING (true);

-- Admins can manage codes (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage invite codes"
ON waitlist_invite_codes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Grant permissions
GRANT SELECT ON waitlist_invite_codes TO anon;
GRANT ALL ON waitlist_invite_codes TO authenticated;

-- ============================================================================
-- Add tracking column to meetings_waitlist
-- ============================================================================

ALTER TABLE meetings_waitlist
ADD COLUMN IF NOT EXISTS invite_code_used TEXT;

-- Index for filtering/analytics by invite code
CREATE INDEX IF NOT EXISTS idx_meetings_waitlist_invite_code
ON meetings_waitlist(invite_code_used);

COMMENT ON COLUMN meetings_waitlist.invite_code_used IS
'The invite code used to sign up. Can be a database code or admin bypass (SIXTY60).';

-- ============================================================================
-- Trigger to increment usage count
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_invite_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if a code was used (not the admin bypass SIXTY60)
  IF NEW.invite_code_used IS NOT NULL AND UPPER(NEW.invite_code_used) != 'SIXTY60' THEN
    UPDATE waitlist_invite_codes
    SET use_count = use_count + 1
    WHERE UPPER(code) = UPPER(NEW.invite_code_used);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists to avoid duplicates)
DROP TRIGGER IF EXISTS increment_invite_code_trigger ON meetings_waitlist;

CREATE TRIGGER increment_invite_code_trigger
AFTER INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION increment_invite_code_usage();

-- ============================================================================
-- Seed initial invite codes
-- ============================================================================

INSERT INTO waitlist_invite_codes (code, description, is_active) VALUES
  ('LAUNCH2025', 'Launch campaign code', true),
  ('PARTNER', 'Partner referral code', true),
  ('DEMO', 'Demo/presentation code', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE waitlist_invite_codes IS
'Invite codes required to join the waitlist. Admin bypass code SIXTY60 is hardcoded in the application.';
