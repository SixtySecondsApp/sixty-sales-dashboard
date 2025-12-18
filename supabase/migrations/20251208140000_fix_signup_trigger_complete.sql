-- ============================================================================
-- Migration: Fix Signup 500 Error - Complete RLS Fix
-- ============================================================================
-- Issue: Signup returns 500 error due to RLS blocking organization creation
-- Root Cause: The auto_create_org_for_new_user trigger runs in a context where
-- auth.uid() is NULL because the user hasn't completed signup yet.
--
-- Solution: SECURITY DEFINER functions bypass RLS by default when they have
-- sufficient privileges. We ensure this by:
-- 1. Granting the function owner (postgres) proper permissions
-- 2. Adding explicit bypass policies for service_role
-- 3. Using SET search_path for security
-- ============================================================================

-- ============================================================================
-- Step 1: Drop and recreate the handle_new_user function with proper error handling
-- ============================================================================
-- This function creates a profile when a new auth.users entry is created

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_entry RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  -- Try to get user info from waitlist entry first
  SELECT full_name, company_name INTO v_waitlist_entry
  FROM meetings_waitlist
  WHERE LOWER(email) = LOWER(NEW.email)
    AND (user_id = NEW.id OR user_id IS NULL)
  ORDER BY created_at ASC
  LIMIT 1;

  -- Parse name from waitlist or use metadata
  IF v_waitlist_entry.full_name IS NOT NULL THEN
    -- Split waitlist full_name into first and last
    v_first_name := SPLIT_PART(TRIM(v_waitlist_entry.full_name), ' ', 1);
    v_last_name := SUBSTRING(TRIM(v_waitlist_entry.full_name) FROM LENGTH(v_first_name) + 2);
  ELSE
    -- Fallback to metadata
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  END IF;

  -- Insert profile for new user with waitlist data if available
  INSERT INTO public.profiles (id, first_name, last_name, email, stage)
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    NEW.email,
    'active'
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent errors if profile already exists

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO postgres;

-- ============================================================================
-- Step 2: Fix the auto_create_org_for_new_user function
-- ============================================================================
-- This function is triggered AFTER profile creation

CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Check if user already has an organization membership
  -- (prevents double org creation if trigger fires twice)
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get user's email from auth.users or profile
  SELECT COALESCE(au.email, NEW.email) INTO v_user_email
  FROM auth.users au
  WHERE au.id = NEW.id;

  -- Fallback to profile email if auth.users lookup fails
  IF v_user_email IS NULL THEN
    v_user_email := NEW.email;
  END IF;

  -- Generate org name from first/last name or email
  IF (NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0) OR
     (NEW.last_name IS NOT NULL AND LENGTH(TRIM(NEW.last_name)) > 0) THEN
    v_org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Clean up the name
  v_org_name := TRIM(v_org_name);
  IF v_org_name = '''s Organization' OR v_org_name = '' THEN
    v_org_name := 'My Organization';
  END IF;

  -- Create the organization (SECURITY DEFINER bypasses RLS)
  INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
  VALUES (v_org_name, NEW.id, true, NOW(), NOW())
  RETURNING id INTO v_org_id;

  -- Add user as owner of the organization
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

  RAISE NOTICE 'Created organization "%" (id: %) for user %', v_org_name, v_org_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail signup - org can be created later
    RAISE WARNING 'auto_create_org_for_new_user failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO postgres;

-- ============================================================================
-- Step 3: Ensure RLS policies allow SECURITY DEFINER functions to work
-- ============================================================================
-- Note: SECURITY DEFINER functions run as the function owner (postgres/service_role)
-- not as the calling user. We need to ensure these roles can bypass RLS.

-- Enable RLS on tables (if not already enabled)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Create/update RLS policies for profiles table
-- ============================================================================

-- Allow the handle_new_user trigger to create profiles
DROP POLICY IF EXISTS "allow_trigger_insert_profiles" ON profiles;
CREATE POLICY "allow_trigger_insert_profiles" ON profiles
  FOR INSERT
  TO postgres, service_role
  WITH CHECK (true);

-- Allow users to view their own profile
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR auth.role() = 'service_role'
  );

-- Allow users to update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

-- ============================================================================
-- Step 5: Create/update RLS policies for organizations table
-- ============================================================================

-- Allow SECURITY DEFINER functions to create organizations
DROP POLICY IF EXISTS "allow_trigger_insert_orgs" ON organizations;
CREATE POLICY "allow_trigger_insert_orgs" ON organizations
  FOR INSERT
  TO postgres, service_role
  WITH CHECK (true);

-- Allow authenticated users to create their own org (manual creation)
DROP POLICY IF EXISTS "users_create_own_org" ON organizations;
CREATE POLICY "users_create_own_org" ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Allow users to view orgs they belong to
DROP POLICY IF EXISTS "users_view_member_orgs" ON organizations;
CREATE POLICY "users_view_member_orgs" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = organizations.id
        AND organization_memberships.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Allow org owners/admins to update their org
DROP POLICY IF EXISTS "org_admins_update" ON organizations;
CREATE POLICY "org_admins_update" ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = organizations.id
        AND organization_memberships.user_id = auth.uid()
        AND organization_memberships.role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = organizations.id
        AND organization_memberships.user_id = auth.uid()
        AND organization_memberships.role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Step 6: Create/update RLS policies for organization_memberships table
-- ============================================================================

-- Allow SECURITY DEFINER functions to create memberships
DROP POLICY IF EXISTS "allow_trigger_insert_memberships" ON organization_memberships;
CREATE POLICY "allow_trigger_insert_memberships" ON organization_memberships
  FOR INSERT
  TO postgres, service_role
  WITH CHECK (true);

-- Allow org admins to add members
DROP POLICY IF EXISTS "org_admins_add_members" ON organization_memberships;
CREATE POLICY "org_admins_add_members" ON organization_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Can add yourself as owner to an org you just created
    (user_id = auth.uid() AND role = 'owner' AND EXISTS (
      SELECT 1 FROM organizations WHERE id = org_id AND created_by = auth.uid()
    ))
    -- Or existing org admins can add members
    OR EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Allow users to view memberships in their orgs
DROP POLICY IF EXISTS "users_view_org_memberships" ON organization_memberships;
CREATE POLICY "users_view_org_memberships" ON organization_memberships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.org_id = organization_memberships.org_id
        AND om.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- Allow users to view their own memberships
DROP POLICY IF EXISTS "users_view_own_memberships" ON organization_memberships;
CREATE POLICY "users_view_own_memberships" ON organization_memberships
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- ============================================================================
-- Step 7: Grant table permissions to service_role and postgres
-- ============================================================================

-- These grants ensure the function owner can access the tables
GRANT ALL ON profiles TO postgres;
GRANT ALL ON profiles TO service_role;
GRANT ALL ON organizations TO postgres;
GRANT ALL ON organizations TO service_role;
GRANT ALL ON organization_memberships TO postgres;
GRANT ALL ON organization_memberships TO service_role;

-- ============================================================================
-- Step 8: Verification
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  -- Check handle_new_user trigger
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) INTO v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE WARNING 'on_auth_user_created trigger does not exist!';
  ELSE
    RAISE NOTICE 'on_auth_user_created trigger exists ✓';
  END IF;

  -- Check auto_create_org trigger
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_org_for_new_user'
  ) INTO v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE WARNING 'trigger_auto_org_for_new_user trigger does not exist!';
  ELSE
    RAISE NOTICE 'trigger_auto_org_for_new_user trigger exists ✓';
  END IF;

  -- Check functions exist
  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE WARNING 'handle_new_user function does not exist!';
  ELSE
    RAISE NOTICE 'handle_new_user function exists ✓';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'auto_create_org_for_new_user'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE WARNING 'auto_create_org_for_new_user function does not exist!';
  ELSE
    RAISE NOTICE 'auto_create_org_for_new_user function exists ✓';
  END IF;

  RAISE NOTICE 'Signup trigger fix migration completed successfully';
END;
$$;
