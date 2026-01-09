-- =====================================================
-- Multi-Tenant: Auto-Create Organization on Signup
-- =====================================================
-- Updates the signup trigger to create a new organization
-- for each user instead of adding them to a default org.
--
-- This ensures "Always create new org" behavior as specified.

-- =====================================================
-- 1. Updated trigger function for auto-creating user org
-- =====================================================
-- Creates a new organization when a user's profile is created
-- and makes the user the owner of that organization

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
  INSERT INTO organizations (name, created_by, is_active, created_at, updated_at)
  VALUES (v_org_name, NEW.id, true, NOW(), NOW())
  RETURNING id INTO v_org_id;

  -- Add user as owner of the organization
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  VALUES (v_org_id, NEW.id, 'owner', NOW(), NOW());

  RAISE NOTICE 'Created organization "%" (id: %) for user %', v_org_name, v_org_id, NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_create_org_for_new_user() IS
  'Automatically creates a new organization when a user profile is created, making the user the owner';

-- =====================================================
-- 2. Replace the existing trigger
-- =====================================================

-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_auto_org_membership_on_profile ON profiles;

-- Create new trigger with the updated function
CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- =====================================================
-- 3. Clean up old function (optional, for clarity)
-- =====================================================
-- Note: We keep the old function in case it's referenced elsewhere,
-- but we can drop it if not needed

-- DROP FUNCTION IF EXISTS auto_create_org_membership_for_new_user();

-- =====================================================
-- 4. Helper function to rename organization
-- =====================================================
-- Allows users to rename their organization during onboarding

CREATE OR REPLACE FUNCTION rename_user_organization(p_new_name TEXT)
RETURNS TABLE(
  success BOOLEAN,
  org_id UUID,
  org_name TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_org_id UUID;
  v_clean_name TEXT;
BEGIN
  -- Get user's organization where they are owner
  SELECT om.org_id INTO v_org_id
  FROM organization_memberships om
  WHERE om.user_id = auth.uid()
    AND om.role = 'owner'
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      NULL::TEXT,
      'No organization found where you are the owner'::TEXT;
    RETURN;
  END IF;

  -- Clean the name
  v_clean_name := TRIM(p_new_name);

  IF LENGTH(v_clean_name) < 1 THEN
    RETURN QUERY SELECT
      false,
      v_org_id,
      NULL::TEXT,
      'Organization name cannot be empty'::TEXT;
    RETURN;
  END IF;

  IF LENGTH(v_clean_name) > 100 THEN
    RETURN QUERY SELECT
      false,
      v_org_id,
      NULL::TEXT,
      'Organization name too long (max 100 characters)'::TEXT;
    RETURN;
  END IF;

  -- Update the organization name
  UPDATE organizations
  SET name = v_clean_name, updated_at = NOW()
  WHERE id = v_org_id;

  RETURN QUERY SELECT
    true,
    v_org_id,
    v_clean_name,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rename_user_organization(TEXT) IS
  'Renames the organization where the current user is an owner';

-- =====================================================
-- 5. Grant execution permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION rename_user_organization(TEXT) TO authenticated;
