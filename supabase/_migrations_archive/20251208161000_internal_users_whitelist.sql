-- ============================================================================
-- Migration: Internal Users Whitelist
-- ============================================================================
-- Replace domain-based internal detection with explicit user whitelist.
-- This gives granular control over who has internal (full) access.
-- ============================================================================

-- Drop the exclusions table we just created (no longer needed)
DROP TABLE IF EXISTS internal_user_exclusions;

-- Create internal users whitelist table
CREATE TABLE IF NOT EXISTS internal_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  added_by UUID REFERENCES auth.users(id),
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_internal_users_email
ON internal_users(email) WHERE is_active = true;

-- Enable RLS
ALTER TABLE internal_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (for feature access checks)
CREATE POLICY "authenticated_read_internal_users" ON internal_users
  FOR SELECT TO authenticated
  USING (true);

-- Allow service_role full access (for admin management)
CREATE POLICY "service_role_manage_internal_users" ON internal_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON internal_users TO authenticated;
GRANT ALL ON internal_users TO service_role;
GRANT ALL ON internal_users TO postgres;

-- Seed with initial internal users (Sixty Seconds team)
-- Add your team members here
INSERT INTO internal_users (email, name, reason, is_active) VALUES
  ('andrew@sixtyseconds.video', 'Andrew Bryce', 'Founder', true),
  ('team@sixtyseconds.video', 'Team Account', 'Team shared account', true)
ON CONFLICT (email) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Note: app@sixtyseconds.video is NOT added, so it will be treated as external/customer

-- Verification
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM internal_users WHERE is_active = true;
  RAISE NOTICE 'Internal users whitelist created with % active users ✓', v_count;
  RAISE NOTICE 'app@sixtyseconds.video NOT in whitelist - will be external ✓';
END;
$$;
