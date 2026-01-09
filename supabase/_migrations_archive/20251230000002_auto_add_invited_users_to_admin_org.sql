-- ============================================================================
-- Migration: Auto-add Invited Users to Admin's Organization
-- ============================================================================
-- Issue: Users invited by admin are not automatically added to the admin's
-- organization, causing them to be invisible to non-admin users due to RLS
-- policies that filter by organization membership.
--
-- Solution: When a profile is created for an invited user, automatically add
-- them to the admin's organization as a member.
--
-- Impact: Admin-invited users will now appear in user management panels and
-- be visible to other organization members based on RLS policies.
-- ============================================================================

-- Create function to add invited users to admin's organization
CREATE OR REPLACE FUNCTION add_invited_user_to_admin_org()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_org_id UUID;
  v_admin_id UUID;
BEGIN
  -- Check if user was invited (has admin ID in metadata)
  v_admin_id := (NEW.id::TEXT); -- Will be overridden if we find admin ID in metadata

  -- Try to get admin ID from profile metadata (set during invitation)
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'invited_by_admin_id' IS NOT NULL THEN
    BEGIN
      v_admin_id := (NEW.raw_user_meta_data->>'invited_by_admin_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to parse invited_by_admin_id for user %: %', NEW.id, SQLERRM;
      RETURN NEW;
    END;
  END IF;

  -- Get the admin's primary organization (owner or admin role)
  SELECT om.org_id INTO v_admin_org_id
  FROM organization_memberships om
  WHERE om.user_id = v_admin_id
    AND om.role IN ('owner', 'admin')
  ORDER BY om.created_at ASC
  LIMIT 1;

  -- If we found an admin organization, add the new user to it
  IF v_admin_org_id IS NOT NULL THEN
    INSERT INTO organization_memberships (org_id, user_id, role, created_at, updated_at)
    VALUES (v_admin_org_id, NEW.id, 'member', NOW(), NOW())
    ON CONFLICT (org_id, user_id) DO NOTHING;

    RAISE NOTICE 'Added invited user % to admin organization %', NEW.id, v_admin_org_id;
  ELSE
    RAISE WARNING 'Could not find admin organization for invited user %', NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'add_invited_user_to_admin_org failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_invited_user_created ON profiles;

-- Create trigger to run after profile creation
CREATE TRIGGER on_invited_user_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION add_invited_user_to_admin_org();

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION add_invited_user_to_admin_org() TO service_role;
GRANT EXECUTE ON FUNCTION add_invited_user_to_admin_org() TO postgres;

-- Verify trigger was created
DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_invited_user_created'
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE 'on_invited_user_created trigger created successfully ✓';
  ELSE
    RAISE WARNING 'on_invited_user_created trigger was not created';
  END IF;

  RAISE NOTICE 'Auto-add invited users to admin organization migration completed';
END;
$$;

-- ============================================================================
-- Migration completed
-- ============================================================================
