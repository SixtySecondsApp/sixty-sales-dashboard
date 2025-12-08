-- ============================================================================
-- Migration: Add Internal User Exclusions
-- ============================================================================
-- Purpose: Allow specific emails from internal domains to be treated as
-- external users for customer testing purposes.
-- ============================================================================

-- Create table for email exclusions
CREATE TABLE IF NOT EXISTS internal_user_exclusions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_internal_user_exclusions_email
ON internal_user_exclusions(email) WHERE is_active = true;

-- Enable RLS
ALTER TABLE internal_user_exclusions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for feature access checks)
CREATE POLICY "authenticated_read_exclusions" ON internal_user_exclusions
  FOR SELECT TO authenticated
  USING (true);

-- Allow admins to manage exclusions
CREATE POLICY "admin_manage_exclusions" ON internal_user_exclusions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON internal_user_exclusions TO authenticated;
GRANT ALL ON internal_user_exclusions TO service_role;
GRANT ALL ON internal_user_exclusions TO postgres;

-- Add the initial exclusion for app@sixtyseconds.video
INSERT INTO internal_user_exclusions (email, reason, is_active)
VALUES ('app@sixtyseconds.video', 'Customer testing account', true)
ON CONFLICT (email) DO UPDATE SET is_active = true, reason = 'Customer testing account';

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Internal user exclusions table created ✓';
  RAISE NOTICE 'app@sixtyseconds.video added to exclusions ✓';
END;
$$;
