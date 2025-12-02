-- =====================================================
-- FIX: Update auto_create_org_for_new_user trigger
-- =====================================================
-- The trigger was referencing NEW.full_name but profiles table
-- has first_name and last_name columns instead.
--
-- Run this in Supabase SQL Editor to fix the trigger.

-- Drop and recreate the trigger function with correct column names
CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_user_email TEXT;
  v_full_name TEXT;
BEGIN
  -- Check if user already has an organization membership
  -- (prevents double org creation if trigger fires twice)
  IF EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = NEW.id
  ) THEN
    RAISE NOTICE 'User % already has organization membership, skipping', NEW.id;
    RETURN NEW;
  END IF;

  -- Get user's email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Build full name from first_name and last_name columns (correct for profiles table!)
  v_full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  -- Generate org name from user's name or email domain
  IF LENGTH(v_full_name) > 1 THEN
    -- Use user's name for org: "Sarah Johnson's Organization"
    v_org_name := v_full_name || '''s Organization';
  ELSIF v_user_email IS NOT NULL AND v_user_email LIKE '%@%' THEN
    -- Extract domain and capitalize: "acme.com" -> "Acme"
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(v_user_email, '@', 2), '.', 1));
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
    -- Don't fail the profile creation if org creation fails
    RAISE WARNING 'Failed to create organization for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO service_role;

-- Verification: Check that the trigger is in place
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname = 'trigger_auto_org_for_new_user';

SELECT 'Trigger fix applied! New signups will create organizations correctly.' as status;
