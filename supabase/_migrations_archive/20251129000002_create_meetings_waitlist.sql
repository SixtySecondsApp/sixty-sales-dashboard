-- Create meetings waitlist system for public signup and referral tracking
-- No authentication required for signup, admin management via platform admin access

-- Status enum for waitlist entries
CREATE TYPE waitlist_status AS ENUM ('pending', 'released', 'declined', 'converted');

-- Main waitlist table
CREATE TABLE meetings_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User information (no auth required)
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,

  -- Tool preferences for integration prioritization
  dialer_tool TEXT,
  dialer_other TEXT,
  meeting_recorder_tool TEXT,
  meeting_recorder_other TEXT,
  crm_tool TEXT,
  crm_other TEXT,

  -- Referral system
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_code TEXT REFERENCES meetings_waitlist(referral_code),
  referral_count INTEGER DEFAULT 0,

  -- Position tracking
  signup_position INTEGER,
  effective_position INTEGER, -- signup_position - (referral_count * 5)

  -- Status and release management
  status waitlist_status NOT NULL DEFAULT 'pending',
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID REFERENCES profiles(id),
  admin_notes TEXT,

  -- Marketing metadata
  utm_source TEXT,
  utm_campaign TEXT,
  utm_medium TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_waitlist_email ON meetings_waitlist(email);
CREATE INDEX idx_waitlist_referral_code ON meetings_waitlist(referral_code);
CREATE INDEX idx_waitlist_referred_by ON meetings_waitlist(referred_by_code);
CREATE INDEX idx_waitlist_status ON meetings_waitlist(status);
CREATE INDEX idx_waitlist_effective_position ON meetings_waitlist(effective_position);
CREATE INDEX idx_waitlist_created_at ON meetings_waitlist(created_at);

-- Add helpful comments
COMMENT ON TABLE meetings_waitlist IS 'Public waitlist for meetings product with referral tracking';
COMMENT ON COLUMN meetings_waitlist.effective_position IS 'Calculated position: signup_position - (referral_count * 5), minimum 1';
COMMENT ON COLUMN meetings_waitlist.referral_code IS 'Unique code like MEET-ABC123 for referring others';
COMMENT ON COLUMN meetings_waitlist.referred_by_code IS 'Referral code of person who referred this signup';

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code like MEET-ABC123
    code := 'MEET-' || upper(substring(md5(random()::text) from 1 for 6));

    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM meetings_waitlist WHERE referral_code = code
    ) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code on insert
CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_referral_code_trigger
BEFORE INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION set_referral_code();

-- Function to set signup position based on current count
CREATE OR REPLACE FUNCTION set_signup_position()
RETURNS TRIGGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  -- Get the highest signup position
  SELECT COALESCE(MAX(signup_position), 0) INTO max_position
  FROM meetings_waitlist;

  -- Set new signup position
  NEW.signup_position := max_position + 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_signup_position_trigger
BEFORE INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION set_signup_position();

-- Function to calculate effective position with referral boost
-- Each referral moves you up 5 spots, minimum position is 1
CREATE OR REPLACE FUNCTION calculate_effective_position()
RETURNS TRIGGER AS $$
BEGIN
  NEW.effective_position := GREATEST(1, NEW.signup_position - (NEW.referral_count * 5));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_position_trigger
BEFORE INSERT OR UPDATE OF referral_count, signup_position ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION calculate_effective_position();

-- Function to increment referral count when someone uses a referral code
CREATE OR REPLACE FUNCTION increment_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    UPDATE meetings_waitlist
    SET referral_count = referral_count + 1
    WHERE referral_code = NEW.referred_by_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_referral_trigger
AFTER INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION increment_referral_count();

-- Auto-update updated_at timestamp
CREATE TRIGGER update_waitlist_timestamp
BEFORE UPDATE ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE meetings_waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert (signup) - no authentication required
CREATE POLICY "Anyone can signup for waitlist"
ON meetings_waitlist FOR INSERT
TO public
WITH CHECK (true);

-- Public can select their own entry by email (no auth)
-- This allows checking position without logging in
CREATE POLICY "Anyone can view waitlist entries"
ON meetings_waitlist FOR SELECT
TO public
USING (true);

-- Platform admins can manage all entries
CREATE POLICY "Platform admins can manage waitlist"
ON meetings_waitlist FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Grant necessary permissions
GRANT SELECT, INSERT ON meetings_waitlist TO anon;
GRANT ALL ON meetings_waitlist TO authenticated;
