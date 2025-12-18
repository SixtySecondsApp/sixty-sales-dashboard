-- ============================================================================
-- Migration: Allow Users to See Profiles of Organization Members
-- ============================================================================
-- Issue: Waitlist users cannot see other users in their organization in the
--        Task manager dropdown because the profiles RLS policy only allows
--        users to see their own profile or all profiles if they're an admin.
--
-- Solution: Update the profiles_select policy to allow users to see profiles
--           of other users in the same organization(s).
-- ============================================================================

-- Drop the existing profiles_select policy
DROP POLICY IF EXISTS "profiles_select" ON profiles;

-- Create new policy that allows users to see:
-- 1. Their own profile
-- 2. Profiles of users in the same organization(s)
-- 3. All profiles if they're an admin
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    is_service_role()
    OR id = auth.uid()
    OR is_admin_optimized()
    OR EXISTS (
      -- User can see profiles of other users in the same organization(s)
      -- This allows waitlist users to see other team members for task assignment
      SELECT 1
      FROM organization_memberships om_current
      INNER JOIN organization_memberships om_other ON om_current.org_id = om_other.org_id
      WHERE om_current.user_id = auth.uid()
        AND om_other.user_id = profiles.id
        AND om_current.user_id != om_other.user_id
    )
  );

COMMENT ON POLICY "profiles_select" ON profiles IS 
  'Allows users to see their own profile, profiles of users in the same organization(s), and all profiles if admin.';
