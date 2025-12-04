-- Migration: Create Clerk User Mapping Table
-- Purpose: Maps Supabase Auth user IDs to Clerk user IDs for authentication migration
-- Created: 2024-12-04

-- Create the mapping table
CREATE TABLE IF NOT EXISTS public.clerk_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID NOT NULL UNIQUE,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.clerk_user_mapping IS 'Maps Supabase Auth user IDs to Clerk user IDs for authentication migration';
COMMENT ON COLUMN public.clerk_user_mapping.supabase_user_id IS 'Original Supabase Auth user UUID';
COMMENT ON COLUMN public.clerk_user_mapping.clerk_user_id IS 'New Clerk user ID (format: user_xxxxx)';
COMMENT ON COLUMN public.clerk_user_mapping.email IS 'User email for reference';
COMMENT ON COLUMN public.clerk_user_mapping.migrated_at IS 'When the user was migrated to Clerk';

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_supabase_id
  ON public.clerk_user_mapping(supabase_user_id);

CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_clerk_id
  ON public.clerk_user_mapping(clerk_user_id);

CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_email
  ON public.clerk_user_mapping(email);

-- Enable RLS
ALTER TABLE public.clerk_user_mapping ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage all mappings
CREATE POLICY "Service role can manage mappings"
  ON public.clerk_user_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read their own mapping
CREATE POLICY "Users can read own mapping"
  ON public.clerk_user_mapping
  FOR SELECT
  TO authenticated
  USING (supabase_user_id = auth.uid());

-- Create function to look up Clerk user ID from Supabase user ID
CREATE OR REPLACE FUNCTION public.get_clerk_user_id(p_supabase_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT clerk_user_id
  FROM public.clerk_user_mapping
  WHERE supabase_user_id = p_supabase_user_id;
$$;

-- Create function to look up Supabase user ID from Clerk user ID
CREATE OR REPLACE FUNCTION public.get_supabase_user_id(p_clerk_user_id TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT supabase_user_id
  FROM public.clerk_user_mapping
  WHERE clerk_user_id = p_clerk_user_id;
$$;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_clerk_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clerk_user_mapping_updated_at
  BEFORE UPDATE ON public.clerk_user_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_clerk_mapping_updated_at();

-- Grant permissions
GRANT SELECT ON public.clerk_user_mapping TO authenticated;
GRANT ALL ON public.clerk_user_mapping TO service_role;
