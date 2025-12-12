-- ============================================================================
-- Migration: Fix Organization Membership RLS for New Users
-- ============================================================================
-- Issue: New users cannot create organizations during onboarding because:
-- 1. They create an organization (works - organizations_insert allows any authenticated user)
-- 2. They try to insert themselves as owner in organization_memberships (FAILS)
--
-- The current policy only allows service_role or admin users to insert memberships,
-- but new users signing up aren't admins yet.
--
-- Solution: Allow authenticated users to insert themselves as owner of orgs they created
-- ============================================================================

-- Drop and recreate the organization_memberships insert policy
DROP POLICY IF EXISTS "organization_memberships_insert" ON organization_memberships;

CREATE POLICY "organization_memberships_insert" ON organization_memberships FOR INSERT
  WITH CHECK (
    is_service_role()
    OR is_admin_optimized()
    -- Allow users to add themselves as owner to orgs they created
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'owner'
      AND EXISTS (
        SELECT 1 FROM organizations
        WHERE id = org_id
        AND created_by = (SELECT auth.uid())
      )
    )
    -- Allow users to add themselves as member (for joining existing orgs)
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'member'
    )
  );

-- Add helpful comment
COMMENT ON POLICY "organization_memberships_insert" ON organization_memberships IS 
  'Allows: service_role, admins, users adding themselves as owner to orgs they created, users joining as members';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'organization_memberships_insert policy updated successfully';
  RAISE NOTICE 'New users can now create organizations during onboarding';
END;
$$;

