-- ============================================================================
-- Migration: Create Dual-Auth User ID Functions
-- Purpose: Functions that work with BOTH Supabase Auth AND Clerk JWTs
-- ============================================================================
-- This enables RLS policies to work seamlessly during the migration period
-- and after full Clerk adoption.
--
-- Key function: current_user_id()
-- - Returns UUID for RLS policies regardless of auth provider
-- - Tries Supabase native auth first (auth.uid())
-- - Falls back to Clerk JWT 'sub' claim via clerk_user_mappings lookup
-- ============================================================================

-- ============================================================================
-- Core Function: current_user_id()
-- ============================================================================
-- This is the main function that ALL RLS policies should use instead of auth.uid()
-- It provides seamless dual-auth support.

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
DECLARE
  v_supabase_id UUID;
  v_clerk_id TEXT;
  v_mapped_id UUID;
BEGIN
  -- Try Supabase native auth first (fastest path for existing users)
  v_supabase_id := auth.uid();
  IF v_supabase_id IS NOT NULL THEN
    RETURN v_supabase_id;
  END IF;

  -- Fall back to Clerk JWT 'sub' claim
  v_clerk_id := auth.jwt()->>'sub';
  IF v_clerk_id IS NOT NULL THEN
    -- Look up the mapped Supabase UUID
    SELECT supabase_user_id INTO v_mapped_id
    FROM clerk_user_mappings
    WHERE clerk_user_id = v_clerk_id;

    IF v_mapped_id IS NOT NULL THEN
      RETURN v_mapped_id;
    END IF;

    -- If no mapping exists, the user might be new from Clerk
    -- Return NULL and let the application handle user creation
    RETURN NULL;
  END IF;

  -- No authentication found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add comment
COMMENT ON FUNCTION current_user_id() IS
  'Returns the current user UUID, supporting both Supabase Auth and Clerk JWTs. '
  'Use this instead of auth.uid() in RLS policies for dual-auth support.';

-- ============================================================================
-- Helper Function: get_auth_provider()
-- ============================================================================
-- Returns which auth provider is being used for the current request

CREATE OR REPLACE FUNCTION get_auth_provider()
RETURNS TEXT AS $$
BEGIN
  -- Check Supabase native auth first
  IF auth.uid() IS NOT NULL THEN
    RETURN 'supabase';
  END IF;

  -- Check for Clerk JWT
  IF (auth.jwt()->>'sub') IS NOT NULL THEN
    RETURN 'clerk';
  END IF;

  RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_auth_provider() IS
  'Returns the authentication provider being used: supabase, clerk, or none';

-- ============================================================================
-- Helper Function: get_clerk_user_id()
-- ============================================================================
-- Returns the Clerk user ID if using Clerk auth, NULL otherwise

CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN auth.jwt()->>'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_clerk_user_id() IS
  'Returns the Clerk user ID from JWT sub claim, or NULL if not using Clerk auth';

-- ============================================================================
-- Helper Function: is_clerk_authenticated()
-- ============================================================================
-- Returns true if the current request is authenticated via Clerk

CREATE OR REPLACE FUNCTION is_clerk_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt()->>'sub') IS NOT NULL
    AND auth.uid() IS NULL;  -- Clerk JWT but not Supabase auth
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_clerk_authenticated() IS
  'Returns true if the current request is authenticated via Clerk JWT';

-- ============================================================================
-- Helper Function: create_clerk_user_mapping()
-- ============================================================================
-- Creates a mapping between a Clerk user and a Supabase profile
-- Should be called during user signup/migration

CREATE OR REPLACE FUNCTION create_clerk_user_mapping(
  p_clerk_user_id TEXT,
  p_supabase_user_id UUID,
  p_email TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO clerk_user_mappings (clerk_user_id, supabase_user_id, email)
  VALUES (p_clerk_user_id, p_supabase_user_id, p_email)
  ON CONFLICT (clerk_user_id) DO UPDATE SET
    supabase_user_id = EXCLUDED.supabase_user_id,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_clerk_user_mapping(TEXT, UUID, TEXT) IS
  'Creates or updates a mapping between a Clerk user ID and Supabase profile UUID';

-- ============================================================================
-- Helper Function: get_supabase_id_for_clerk_user()
-- ============================================================================
-- Looks up the Supabase profile UUID for a given Clerk user ID

CREATE OR REPLACE FUNCTION get_supabase_id_for_clerk_user(p_clerk_user_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_supabase_id UUID;
BEGIN
  SELECT supabase_user_id INTO v_supabase_id
  FROM clerk_user_mappings
  WHERE clerk_user_id = p_clerk_user_id;

  RETURN v_supabase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_supabase_id_for_clerk_user(TEXT) IS
  'Returns the Supabase profile UUID for a given Clerk user ID';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  v_test_result UUID;
BEGIN
  -- Test that current_user_id() function exists and runs without error
  SELECT current_user_id() INTO v_test_result;
  -- Result will be NULL since we're running as migration user

  -- Verify get_auth_provider() works
  PERFORM get_auth_provider();

  -- Verify is_clerk_authenticated() works
  PERFORM is_clerk_authenticated();

  RAISE NOTICE 'Dual-auth functions created successfully';
END;
$$;
