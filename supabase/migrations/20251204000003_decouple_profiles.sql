-- ============================================================================
-- Migration: Decouple Profiles Table from auth.users
-- Purpose: Allow profiles to exist without corresponding auth.users entries
-- ============================================================================
-- This enables:
-- 1. Clerk users to have profiles without Supabase Auth accounts
-- 2. Shared profiles across branches (production, dev, preview)
-- 3. Clean migration from Supabase Auth to Clerk
-- ============================================================================

-- ============================================================================
-- Step 1: Remove Foreign Key Constraint
-- ============================================================================
-- The profiles table currently has a FK to auth.users(id)
-- We need to remove this to allow Clerk-only users

-- First, check if the constraint exists and drop it
DO $$
BEGIN
  -- Drop the FK constraint if it exists
  -- Common constraint names from Supabase
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
    RAISE NOTICE 'Dropped constraint: profiles_id_fkey';
  END IF;

  -- Also check for other possible constraint names
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_user_id_fkey'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_fkey;
    RAISE NOTICE 'Dropped constraint: profiles_user_id_fkey';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_profiles_auth_users'
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT fk_profiles_auth_users;
    RAISE NOTICE 'Dropped constraint: fk_profiles_auth_users';
  END IF;
END;
$$;

-- ============================================================================
-- Step 2: Add Clerk-specific Columns
-- ============================================================================

-- Add clerk_user_id column to track Clerk authentication
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Add auth_provider column to track which auth system created the user
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'supabase';

-- Add helpful comments
COMMENT ON COLUMN profiles.clerk_user_id IS
  'Clerk user ID for users authenticated via Clerk (e.g., user_2abc123...)';

COMMENT ON COLUMN profiles.auth_provider IS
  'Authentication provider: supabase (default), clerk, or both (during migration)';

-- ============================================================================
-- Step 3: Create Indexes for Clerk Lookups
-- ============================================================================

-- Index for looking up profiles by Clerk user ID
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_user_id
  ON profiles(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;

-- Index for filtering by auth provider
CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider
  ON profiles(auth_provider)
  WHERE auth_provider IS NOT NULL;

-- ============================================================================
-- Step 4: Create Helper Function for Profile Lookup
-- ============================================================================

-- Function to find profile by either Supabase ID or Clerk ID
CREATE OR REPLACE FUNCTION get_profile_for_current_user()
RETURNS SETOF profiles AS $$
DECLARE
  v_user_id UUID;
  v_clerk_id TEXT;
BEGIN
  -- Get current user ID (handles both auth systems)
  v_user_id := current_user_id();

  IF v_user_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM profiles WHERE id = v_user_id LIMIT 1;
    RETURN;
  END IF;

  -- If no mapping found, try direct Clerk ID lookup
  v_clerk_id := get_clerk_user_id();
  IF v_clerk_id IS NOT NULL THEN
    RETURN QUERY SELECT * FROM profiles WHERE clerk_user_id = v_clerk_id LIMIT 1;
    RETURN;
  END IF;

  -- No profile found
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_profile_for_current_user() IS
  'Returns the profile for the current user, supporting both Supabase and Clerk auth';

-- ============================================================================
-- Step 5: Create Function to Link Clerk User to Profile
-- ============================================================================

-- Function to link an existing profile to a Clerk user
CREATE OR REPLACE FUNCTION link_profile_to_clerk_user(
  p_profile_id UUID,
  p_clerk_user_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the profile with Clerk user ID
  UPDATE profiles
  SET
    clerk_user_id = p_clerk_user_id,
    auth_provider = CASE
      WHEN auth_provider = 'supabase' THEN 'both'
      ELSE 'clerk'
    END,
    updated_at = NOW()
  WHERE id = p_profile_id;

  -- Also create/update the mapping table
  PERFORM create_clerk_user_mapping(p_clerk_user_id, p_profile_id, (
    SELECT email FROM profiles WHERE id = p_profile_id
  ));

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION link_profile_to_clerk_user(UUID, TEXT) IS
  'Links an existing Supabase profile to a Clerk user ID';

-- ============================================================================
-- Step 6: Create Function to Create Profile for Clerk User
-- ============================================================================

-- Function to create a new profile for a Clerk user
CREATE OR REPLACE FUNCTION create_profile_for_clerk_user(
  p_clerk_user_id TEXT,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_profile_id UUID;
  v_display_name TEXT;
BEGIN
  -- Generate a new UUID for the profile
  v_profile_id := gen_random_uuid();

  -- Determine display name
  v_display_name := COALESCE(
    p_full_name,
    NULLIF(TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, '')), ''),
    split_part(p_email, '@', 1)
  );

  -- Create the profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    clerk_user_id,
    auth_provider,
    created_at,
    updated_at
  ) VALUES (
    v_profile_id,
    p_email,
    v_display_name,
    p_clerk_user_id,
    'clerk',
    NOW(),
    NOW()
  );

  -- Create the mapping
  PERFORM create_clerk_user_mapping(p_clerk_user_id, v_profile_id, p_email);

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_profile_for_clerk_user(TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Creates a new profile for a Clerk user and adds the mapping';

-- ============================================================================
-- Step 7: Update RLS Policies to Support Both Auth Systems
-- ============================================================================

-- Update the profiles SELECT policy to use current_user_id()
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (
    id = current_user_id()
    OR clerk_user_id = get_clerk_user_id()
  );

-- Update the profiles UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (
    id = current_user_id()
    OR clerk_user_id = get_clerk_user_id()
  )
  WITH CHECK (
    id = current_user_id()
    OR clerk_user_id = get_clerk_user_id()
  );

-- Allow service role to manage all profiles (for user creation)
DROP POLICY IF EXISTS "Service role can manage all profiles" ON profiles;
CREATE POLICY "Service role can manage all profiles"
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  -- Verify clerk_user_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'clerk_user_id'
  ) THEN
    RAISE EXCEPTION 'clerk_user_id column was not added to profiles';
  END IF;

  -- Verify auth_provider column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'auth_provider'
  ) THEN
    RAISE EXCEPTION 'auth_provider column was not added to profiles';
  END IF;

  -- Verify FK constraint was removed (if it existed)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND table_name = 'profiles'
  ) THEN
    RAISE WARNING 'profiles_id_fkey constraint still exists - may need manual removal';
  END IF;

  RAISE NOTICE 'Profiles table decoupled successfully';
END;
$$;
