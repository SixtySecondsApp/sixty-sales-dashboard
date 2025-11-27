-- =====================================================
-- FIX: Organization Creation Trigger
-- =====================================================
-- This fixes the signup error by using the profile's email
-- directly from the NEW row instead of querying auth.users
--
-- IMPORTANT: The profiles table has first_name, last_name, email
-- but NOT full_name - the original trigger referenced full_name which doesn't exist!

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;
DROP FUNCTION IF EXISTS auto_create_org_for_new_user();

-- Create improved function that uses CORRECT profile columns
CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Check if user already has an organization membership
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Build full name from first_name and last_name (profiles table columns)
  v_full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));

  -- Generate org name from profile's name or email
  IF v_full_name IS NOT NULL AND LENGTH(v_full_name) > 0 THEN
    v_org_name := v_full_name || '''s Organization';
  ELSIF NEW.first_name IS NOT NULL AND LENGTH(TRIM(NEW.first_name)) > 0 THEN
    v_org_name := TRIM(NEW.first_name) || '''s Organization';
  ELSIF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(NEW.email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Create the organization
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
    -- Log the error but don't fail the signup
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO authenticated;

-- Also ensure profiles INSERT policy allows service_role
DROP POLICY IF EXISTS "Enable profile creation" ON profiles;
CREATE POLICY "Enable profile creation"
  ON profiles FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() = id
  );

-- Verification
SELECT 'Organization trigger fix applied!' as status;
