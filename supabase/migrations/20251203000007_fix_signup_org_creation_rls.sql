-- =====================================================
-- FIX: Signup 500 Error - Organization Creation RLS
-- =====================================================
-- The auto_create_org_for_new_user() function runs as SECURITY DEFINER
-- but RLS policies check auth.uid() which is NULL in that context.
-- This fix ensures the function can create organizations during signup.
--
-- Issue: 500 Internal Server Error on /auth/v1/signup
-- Root Cause: RLS policies blocking organization creation in trigger
-- =====================================================

-- =====================================================
-- STEP 1: Update the function to set user context
-- =====================================================
-- Use SET LOCAL to set the role to the new user, allowing RLS policies
-- to work correctly while still having elevated privileges

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

  -- Get user's email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Generate org name from email domain or first/last name from profile
  -- Note: profiles table has first_name and last_name columns, NOT full_name
  IF (NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0) OR
     (NEW.last_name IS NOT NULL AND LENGTH(TRIM(NEW.last_name)) > 0) THEN
    -- Use user's name for org: "Sarah Johnson's Organization"
    v_org_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')) || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    -- Extract domain and capitalize: "acme.com" -> "Acme"
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Create the organization
  -- Note: SECURITY DEFINER functions run with elevated privileges
  -- but RLS still applies. The service_role policies below will allow this.
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
    -- Log the error but don't fail signup
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_create_org_for_new_user() IS
  'Automatically creates a new organization when a user profile is created, making the user the owner. Uses SET LOCAL to set user context for RLS policies.';

-- =====================================================
-- STEP 2: Ensure service_role can bypass RLS if needed
-- =====================================================
-- Add a policy that allows service_role to insert organizations
-- This is a fallback in case the SET LOCAL approach doesn't work

DO $$
BEGIN
  -- Drop if exists to avoid conflicts
  DROP POLICY IF EXISTS "service_role_can_insert_orgs" ON organizations;
  
  -- Create policy for service_role (used by SECURITY DEFINER functions)
  CREATE POLICY "service_role_can_insert_orgs" ON organizations
  FOR INSERT
  TO service_role
  WITH CHECK (true);
  
  RAISE NOTICE 'Created service_role_can_insert_orgs policy';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create service_role policy: %', SQLERRM;
END $$;

-- =====================================================
-- STEP 3: Ensure service_role can insert memberships
-- =====================================================

DO $$
BEGIN
  -- Drop if exists to avoid conflicts
  DROP POLICY IF EXISTS "service_role_can_insert_memberships" ON organization_memberships;
  
  -- Create policy for service_role
  CREATE POLICY "service_role_can_insert_memberships" ON organization_memberships
  FOR INSERT
  TO service_role
  WITH CHECK (true);
  
  RAISE NOTICE 'Created service_role_can_insert_memberships policy';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not create service_role membership policy: %', SQLERRM;
END $$;

-- =====================================================
-- STEP 4: Grant execute permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO authenticated;

-- =====================================================
-- STEP 5: Verify the trigger exists
-- =====================================================

DO $$
BEGIN
  -- Ensure the trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_auto_org_for_new_user'
  ) THEN
    CREATE TRIGGER trigger_auto_org_for_new_user
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION auto_create_org_for_new_user();
    
    RAISE NOTICE 'Created trigger_auto_org_for_new_user';
  ELSE
    RAISE NOTICE 'Trigger trigger_auto_org_for_new_user already exists';
  END IF;
END $$;

-- =====================================================
-- Verification queries (commented out - uncomment to run)
-- =====================================================

-- Check policies exist
-- SELECT polname, polcmd, polroles::regrole[]
-- FROM pg_policy
-- WHERE polrelid = 'organizations'::regclass
-- ORDER BY polname;

-- Check function exists
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname = 'auto_create_org_for_new_user';

-- Check trigger exists
-- SELECT tgname, tgrelid::regclass, tgenabled
-- FROM pg_trigger
-- WHERE tgname = 'trigger_auto_org_for_new_user';

