-- ============================================================================
-- MANUAL MIGRATION: Create Meetings Waitlist System
-- ============================================================================
-- Run this in Supabase SQL Editor to create the waitlist table
-- This is a standalone script that can be executed independently
-- ============================================================================

-- Drop existing objects if they exist (for clean re-runs)
DROP TABLE IF EXISTS meetings_waitlist CASCADE;
DROP TYPE IF EXISTS waitlist_status CASCADE;
DROP FUNCTION IF EXISTS generate_referral_code() CASCADE;
DROP TRIGGER IF EXISTS set_waitlist_referral_code ON meetings_waitlist CASCADE;
DROP TRIGGER IF EXISTS update_waitlist_position ON meetings_waitlist CASCADE;
DROP TRIGGER IF EXISTS increment_referrer_count ON meetings_waitlist CASCADE;
DROP TRIGGER IF EXISTS update_meetings_waitlist_updated_at ON meetings_waitlist CASCADE;

-- ============================================================================
-- 1. Create Status Enum
-- ============================================================================
CREATE TYPE waitlist_status AS ENUM ('pending', 'released', 'declined', 'converted');

-- ============================================================================
-- 2. Create Main Waitlist Table
-- ============================================================================
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

-- ============================================================================
-- 3. Create Indexes for Performance
-- ============================================================================
CREATE INDEX idx_waitlist_email ON meetings_waitlist(email);
CREATE INDEX idx_waitlist_referral_code ON meetings_waitlist(referral_code);
CREATE INDEX idx_waitlist_referred_by ON meetings_waitlist(referred_by_code);
CREATE INDEX idx_waitlist_status ON meetings_waitlist(status);
CREATE INDEX idx_waitlist_effective_position ON meetings_waitlist(effective_position);
CREATE INDEX idx_waitlist_created_at ON meetings_waitlist(created_at);

-- ============================================================================
-- 4. Add Table Comments
-- ============================================================================
COMMENT ON TABLE meetings_waitlist IS 'Public waitlist for meetings product with referral tracking';
COMMENT ON COLUMN meetings_waitlist.effective_position IS 'Calculated position: signup_position - (referral_count * 5), minimum 1';
COMMENT ON COLUMN meetings_waitlist.referral_code IS 'Unique code like MEET-ABC123 for referring others';
COMMENT ON COLUMN meetings_waitlist.referred_by_code IS 'Referral code of person who referred this signup';

-- ============================================================================
-- 5. Create Referral Code Generator Function
-- ============================================================================
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

-- ============================================================================
-- 6. Create Trigger to Auto-Generate Referral Codes
-- ============================================================================
CREATE OR REPLACE FUNCTION set_waitlist_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_waitlist_referral_code
  BEFORE INSERT ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION set_waitlist_referral_code();

-- ============================================================================
-- 7. Create Trigger to Auto-Set Signup Position
-- ============================================================================
CREATE OR REPLACE FUNCTION update_waitlist_position()
RETURNS TRIGGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  -- Get the current max position
  SELECT COALESCE(MAX(signup_position), 0) INTO max_position
  FROM meetings_waitlist;

  -- Set position for new entry
  NEW.signup_position := max_position + 1;

  -- Calculate effective position (minimum 1)
  NEW.effective_position := GREATEST(1, NEW.signup_position - (NEW.referral_count * 5));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_waitlist_position
  BEFORE INSERT ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_position();

-- ============================================================================
-- 8. Create Trigger to Increment Referrer Count
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_referrer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referred_by_code IS NOT NULL THEN
    -- Increment the referral count for the referrer
    UPDATE meetings_waitlist
    SET referral_count = referral_count + 1
    WHERE referral_code = NEW.referred_by_code;

    -- Recalculate effective position for the referrer
    UPDATE meetings_waitlist
    SET effective_position = GREATEST(1, signup_position - (referral_count * 5))
    WHERE referral_code = NEW.referred_by_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_referrer_count
  AFTER INSERT ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION increment_referrer_count();

-- ============================================================================
-- 9. Create Trigger to Auto-Update updated_at Timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meetings_waitlist_updated_at
  BEFORE UPDATE ON meetings_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE meetings_waitlist ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. Create RLS Policies
-- ============================================================================

-- Public: Anyone can insert (sign up for waitlist)
CREATE POLICY "Anyone can sign up for waitlist"
  ON meetings_waitlist
  FOR INSERT
  WITH CHECK (true);

-- Public: Users can view their own entry by email
CREATE POLICY "Users can view their own waitlist entry"
  ON meetings_waitlist
  FOR SELECT
  USING (
    email = current_setting('request.jwt.claims', true)::json->>'email'
    OR auth.uid() IS NULL -- Allow unauthenticated access for public lookups
  );

-- Admin: Platform admins can view all entries
CREATE POLICY "Admins can view all waitlist entries"
  ON meetings_waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin: Platform admins can update entries
CREATE POLICY "Admins can update waitlist entries"
  ON meetings_waitlist
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin: Platform admins can delete entries
CREATE POLICY "Admins can delete waitlist entries"
  ON meetings_waitlist
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- You can now use the waitlist system. Test with:
-- INSERT INTO meetings_waitlist (email, full_name, company_name)
-- VALUES ('test@example.com', 'Test User', 'Test Company');
-- ============================================================================
