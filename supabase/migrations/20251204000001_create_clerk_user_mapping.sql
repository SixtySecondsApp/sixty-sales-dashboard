-- ============================================================================
-- Migration: Create Clerk User Mapping Table
-- Purpose: Map Clerk user IDs to Supabase profile UUIDs for dual-auth support
-- ============================================================================
-- This table enables:
-- 1. Shared authentication across all Supabase branches (production, dev, preview)
-- 2. RLS policies working with both Supabase Auth and Clerk JWTs
-- 3. Seamless migration from Supabase Auth to Clerk
-- ============================================================================

-- Create the clerk_user_mappings table
CREATE TABLE IF NOT EXISTS clerk_user_mappings (
  -- Clerk user ID (e.g., 'user_2abc123...')
  clerk_user_id TEXT PRIMARY KEY,

  -- Corresponding Supabase profile UUID
  -- This links to the profiles table, NOT auth.users
  supabase_user_id UUID NOT NULL,

  -- User's email for lookup and debugging
  email TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one-to-one mapping
  UNIQUE(supabase_user_id),
  UNIQUE(email)
);

-- Add helpful comment
COMMENT ON TABLE clerk_user_mappings IS 'Maps Clerk user IDs to Supabase profile UUIDs for dual-auth support';
COMMENT ON COLUMN clerk_user_mappings.clerk_user_id IS 'Clerk user ID from JWT sub claim (e.g., user_2abc123...)';
COMMENT ON COLUMN clerk_user_mappings.supabase_user_id IS 'UUID from profiles table, used for all FK relationships';
COMMENT ON COLUMN clerk_user_mappings.email IS 'User email for lookup and debugging purposes';

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_clerk_mapping_supabase_id
  ON clerk_user_mappings(supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_clerk_mapping_email
  ON clerk_user_mappings(email);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_clerk_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clerk_mapping_updated_at ON clerk_user_mappings;
CREATE TRIGGER clerk_mapping_updated_at
  BEFORE UPDATE ON clerk_user_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_clerk_mapping_updated_at();

-- RLS policies for clerk_user_mappings
ALTER TABLE clerk_user_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own mapping
CREATE POLICY "Users can view their own mapping"
  ON clerk_user_mappings
  FOR SELECT
  USING (
    -- Supabase Auth: match by auth.uid()
    supabase_user_id = auth.uid()
    OR
    -- Clerk Auth: match by JWT sub claim
    clerk_user_id = (auth.jwt()->>'sub')
  );

-- Only service role can insert/update/delete mappings
-- This prevents users from manipulating their mappings
CREATE POLICY "Service role can manage all mappings"
  ON clerk_user_mappings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'clerk_user_mappings'
  ) THEN
    RAISE EXCEPTION 'clerk_user_mappings table was not created';
  END IF;

  -- Verify indexes exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_clerk_mapping_supabase_id'
  ) THEN
    RAISE EXCEPTION 'idx_clerk_mapping_supabase_id index was not created';
  END IF;

  RAISE NOTICE 'clerk_user_mappings table created successfully';
END;
$$;
