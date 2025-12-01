-- Add Email Invites tracking table
-- This migration adds support for bulk email invitations with automatic referral link generation

-- Create waitlist_email_invites table
CREATE TABLE IF NOT EXISTS waitlist_email_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_entry_id UUID NOT NULL REFERENCES meetings_waitlist(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invite_status VARCHAR(50) DEFAULT 'pending' CHECK (invite_status IN ('pending', 'sent', 'failed', 'converted')),
  sent_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_invites_entry_id ON waitlist_email_invites(waitlist_entry_id);
CREATE INDEX IF NOT EXISTS idx_email_invites_status ON waitlist_email_invites(invite_status);
CREATE INDEX IF NOT EXISTS idx_email_invites_email ON waitlist_email_invites(email);

-- Add unique constraint to prevent duplicate invites
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_invites_unique ON waitlist_email_invites(waitlist_entry_id, email);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON waitlist_email_invites;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON waitlist_email_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'waitlist_email_invites'
ORDER BY ordinal_position;
