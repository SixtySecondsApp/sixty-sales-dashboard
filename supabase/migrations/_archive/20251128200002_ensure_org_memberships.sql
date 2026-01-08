-- =====================================================
-- Multi-Tenant: Ensure All Users Have Org Membership
-- =====================================================
-- This migration ensures:
-- 1. A "Default Organization" exists
-- 2. All existing users have organization membership
-- 3. Profiles without user records are handled gracefully

-- Create or get the default organization
DO $$
DECLARE
  default_org_id UUID;
  users_added INTEGER := 0;
  profiles_count INTEGER;
  memberships_created INTEGER := 0;
BEGIN
  -- Check if Default Organization exists
  SELECT id INTO default_org_id
  FROM organizations
  WHERE name = 'Default Organization'
  LIMIT 1;

  -- Create if it doesn't exist
  IF default_org_id IS NULL THEN
    INSERT INTO organizations (name, is_active, created_at, updated_at)
    VALUES ('Default Organization', true, NOW(), NOW())
    RETURNING id INTO default_org_id;

    RAISE NOTICE 'Created Default Organization with id: %', default_org_id;
  ELSE
    RAISE NOTICE 'Default Organization already exists with id: %', default_org_id;
  END IF;

  -- Count profiles without org membership
  SELECT COUNT(*) INTO profiles_count
  FROM profiles p
  LEFT JOIN organization_memberships om ON p.id = om.user_id
  WHERE om.user_id IS NULL;

  RAISE NOTICE 'Found % profiles without organization membership', profiles_count;

  -- Add all profiles without membership to default organization as 'owner'
  -- Using 'owner' role so existing users have full access to their data
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  SELECT
    default_org_id,
    p.id,
    'owner',
    NOW(),
    NOW()
  FROM profiles p
  LEFT JOIN organization_memberships om ON p.id = om.user_id
  WHERE om.user_id IS NULL
  ON CONFLICT (org_id, user_id) DO NOTHING;

  GET DIAGNOSTICS memberships_created = ROW_COUNT;
  RAISE NOTICE 'Created % new organization memberships', memberships_created;

  -- Also handle users in auth.users that might not have profiles
  INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
  SELECT
    default_org_id,
    u.id,
    'owner',
    NOW(),
    NOW()
  FROM auth.users u
  LEFT JOIN organization_memberships om ON u.id = om.user_id
  WHERE om.user_id IS NULL
  ON CONFLICT (org_id, user_id) DO NOTHING;

  GET DIAGNOSTICS users_added = ROW_COUNT;
  IF users_added > 0 THEN
    RAISE NOTICE 'Created % additional memberships for auth.users without profiles', users_added;
  END IF;

END $$;

-- =====================================================
-- Create trigger to auto-add new users to default org
-- =====================================================
-- This ensures new users get added to an organization immediately

CREATE OR REPLACE FUNCTION auto_create_org_membership_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get default organization (will be created by signup if this is a new setup)
  SELECT id INTO default_org_id
  FROM organizations
  WHERE name = 'Default Organization'
  LIMIT 1;

  -- Only add membership if user doesn't already have one
  -- and a default org exists (may not exist in fresh installs)
  IF default_org_id IS NOT NULL THEN
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (default_org_id, NEW.id, 'member', NOW(), NOW())
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_org_membership_on_profile ON profiles;

-- Create trigger on profiles table (fires when profile is created)
CREATE TRIGGER trigger_auto_org_membership_on_profile
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_membership_for_new_user();

-- =====================================================
-- Validation queries (for manual verification)
-- =====================================================
-- Run these after migration to verify:
--
-- 1. Check all users have org membership:
-- SELECT COUNT(*) as orphan_users
-- FROM auth.users u
-- LEFT JOIN organization_memberships om ON u.id = om.user_id
-- WHERE om.user_id IS NULL;
-- -- Expected: 0
--
-- 2. Check default org exists:
-- SELECT * FROM organizations WHERE name = 'Default Organization';
-- -- Expected: 1 row
--
-- 3. Check membership counts:
-- SELECT
--   o.name,
--   COUNT(om.user_id) as member_count,
--   COUNT(CASE WHEN om.role = 'owner' THEN 1 END) as owners,
--   COUNT(CASE WHEN om.role = 'admin' THEN 1 END) as admins,
--   COUNT(CASE WHEN om.role = 'member' THEN 1 END) as members
-- FROM organizations o
-- LEFT JOIN organization_memberships om ON o.id = om.org_id
-- GROUP BY o.id, o.name;
