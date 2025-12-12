-- ============================================================================
-- FIX MISSING WAITLIST TABLE
-- ============================================================================
-- This script creates the meetings_waitlist table if it doesn't exist.
-- Run this in Supabase SQL Editor if you get the error:
-- "relation 'meetings_waitlist' does not exist"
-- ============================================================================

-- Check if the enum type exists first, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
    CREATE TYPE waitlist_status AS ENUM ('pending', 'released', 'declined', 'converted');
  END IF;
END$$;

-- Create the waitlist table if it doesn't exist
CREATE TABLE IF NOT EXISTS meetings_waitlist (
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
  referred_by_code TEXT,
  referral_count INTEGER DEFAULT 0,

  -- Position tracking
  signup_position INTEGER,
  effective_position INTEGER,

  -- Status and release management
  status waitlist_status NOT NULL DEFAULT 'pending',
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID,
  admin_notes TEXT,

  -- Marketing metadata
  utm_source TEXT,
  utm_campaign TEXT,
  utm_medium TEXT,

  -- Additional columns from later migrations
  is_seeded BOOLEAN DEFAULT false,
  total_points INTEGER DEFAULT 0,
  twitter_boost_claimed BOOLEAN DEFAULT false,
  linkedin_share_claimed BOOLEAN DEFAULT false,
  linkedin_boost_claimed BOOLEAN DEFAULT false,
  linkedin_first_share_at TIMESTAMP WITH TIME ZONE,
  display_rank INTEGER,
  profile_image_url TEXT,
  magic_link_sent_at TIMESTAMP WITH TIME ZONE,
  magic_link_expires_at TIMESTAMP WITH TIME ZONE,
  granted_access_at TIMESTAMP WITH TIME ZONE,
  granted_by UUID,
  access_granted_by UUID,
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add self-referential foreign key constraint
ALTER TABLE meetings_waitlist 
DROP CONSTRAINT IF EXISTS meetings_waitlist_referred_by_code_fkey;

ALTER TABLE meetings_waitlist 
ADD CONSTRAINT meetings_waitlist_referred_by_code_fkey 
FOREIGN KEY (referred_by_code) REFERENCES meetings_waitlist(referral_code);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON meetings_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON meetings_waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON meetings_waitlist(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON meetings_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_effective_position ON meetings_waitlist(effective_position);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON meetings_waitlist(created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_total_points ON meetings_waitlist(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_display_rank ON meetings_waitlist(display_rank);

-- Add helpful comments
COMMENT ON TABLE meetings_waitlist IS 'Public waitlist for meetings product with referral tracking';
COMMENT ON COLUMN meetings_waitlist.effective_position IS 'Calculated position: signup_position - (referral_count * 5), minimum 1';
COMMENT ON COLUMN meetings_waitlist.referral_code IS 'Unique code like MEET-ABC123 for referring others';
COMMENT ON COLUMN meetings_waitlist.referred_by_code IS 'Referral code of person who referred this signup';

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := 'MEET-' || upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(
      SELECT 1 FROM meetings_waitlist WHERE referral_code = code
    ) INTO code_exists;
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

DROP TRIGGER IF EXISTS set_referral_code_trigger ON meetings_waitlist;
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
  SELECT COALESCE(MAX(signup_position), 0) INTO max_position
  FROM meetings_waitlist;
  NEW.signup_position := max_position + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_signup_position_trigger ON meetings_waitlist;
CREATE TRIGGER set_signup_position_trigger
BEFORE INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION set_signup_position();

-- Function to calculate effective position with referral boost
CREATE OR REPLACE FUNCTION calculate_effective_position()
RETURNS TRIGGER AS $$
BEGIN
  NEW.effective_position := GREATEST(1, NEW.signup_position - (NEW.referral_count * 5));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_position_trigger ON meetings_waitlist;
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

DROP TRIGGER IF EXISTS increment_referral_trigger ON meetings_waitlist;
CREATE TRIGGER increment_referral_trigger
AFTER INSERT ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION increment_referral_count();

-- Create update_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_waitlist_timestamp ON meetings_waitlist;
CREATE TRIGGER update_waitlist_timestamp
BEFORE UPDATE ON meetings_waitlist
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE meetings_waitlist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Anyone can signup for waitlist" ON meetings_waitlist;
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON meetings_waitlist;
DROP POLICY IF EXISTS "Platform admins can manage waitlist" ON meetings_waitlist;

-- Public can insert (signup) - no authentication required
CREATE POLICY "Anyone can signup for waitlist"
ON meetings_waitlist FOR INSERT
TO public
WITH CHECK (true);

-- Public can select their own entry by email (no auth)
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify the table was created
SELECT 
  'SUCCESS: meetings_waitlist table created!' as status,
  count(*) as existing_entries
FROM meetings_waitlist;

