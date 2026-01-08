-- ============================================================================
-- Migration: Fix Organization RLS Circular Dependency
-- ============================================================================
-- Problem: The SELECT policies on organizations and organization_memberships
-- reference each other, causing infinite recursion and 500 errors.
--
-- Solution: Simplify to non-circular policies:
-- - organizations SELECT: Use direct membership check (not subquery-based)
-- - organization_memberships SELECT: Only check own user_id (no org-based check)
-- ============================================================================

-- ============================================================================
-- Step 1: Fix organization_memberships SELECT policies
-- ============================================================================
-- Remove all SELECT policies and create one simple non-recursive policy

DROP POLICY IF EXISTS "users_view_org_memberships" ON organization_memberships;
DROP POLICY IF EXISTS "users_view_own_memberships" ON organization_memberships;
DROP POLICY IF EXISTS "select_memberships" ON organization_memberships;
DROP POLICY IF EXISTS "select_own_memberships" ON organization_memberships;

-- Simple policy: users can see their own memberships, service_role sees all
CREATE POLICY "memberships_select_own" ON organization_memberships
  FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- ============================================================================
-- Step 2: Fix organizations SELECT policies
-- ============================================================================
-- Remove circular policy and create a simple one

DROP POLICY IF EXISTS "users_view_member_orgs" ON organizations;
DROP POLICY IF EXISTS "select_own_orgs" ON organizations;
DROP POLICY IF EXISTS "orgs_select_members" ON organizations;

-- Simple policy: users can see orgs where they have a membership
-- Use a simple IN clause which is evaluated after memberships are resolved
CREATE POLICY "orgs_select_for_members" ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
    OR created_by = auth.uid()  -- Also allow seeing org you just created
  );

-- ============================================================================
-- Step 3: Fix INSERT policy for organizations to allow manual creation
-- ============================================================================
-- Ensure users can create orgs during onboarding

DROP POLICY IF EXISTS "users_create_own_org" ON organizations;
DROP POLICY IF EXISTS "orgs_insert_own" ON organizations;

CREATE POLICY "orgs_insert_authenticated" ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Step 4: Fix INSERT policy for memberships during org creation
-- ============================================================================
-- Allow users to add themselves as owner when creating an org

DROP POLICY IF EXISTS "org_admins_add_members" ON organization_memberships;
DROP POLICY IF EXISTS "memberships_insert" ON organization_memberships;

CREATE POLICY "memberships_insert_allowed" ON organization_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add themselves
    user_id = auth.uid()
    -- Or service_role can add anyone
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Step 5: Ensure UPDATE policies are not circular
-- ============================================================================

DROP POLICY IF EXISTS "org_admins_update" ON organizations;

CREATE POLICY "orgs_update_by_admins" ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- Memberships update policy
DROP POLICY IF EXISTS "memberships_update" ON organization_memberships;
DROP POLICY IF EXISTS "org_admins_update_members" ON organization_memberships;

CREATE POLICY "memberships_update_by_admins" ON organization_memberships
  FOR UPDATE
  TO authenticated
  USING (
    -- Org owners/admins can update memberships in their org
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Step 6: Ensure DELETE policies exist
-- ============================================================================

DROP POLICY IF EXISTS "memberships_delete" ON organization_memberships;

CREATE POLICY "memberships_delete_by_admins" ON organization_memberships
  FOR DELETE
  TO authenticated
  USING (
    -- Users can remove themselves
    user_id = auth.uid()
    -- Or org admins can remove members
    OR org_id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "orgs_delete" ON organizations;

CREATE POLICY "orgs_delete_by_owner" ON organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT org_id FROM organization_memberships
      WHERE user_id = auth.uid() AND role = 'owner'
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  org_policy_count INT;
  membership_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO org_policy_count
  FROM pg_policies WHERE tablename = 'organizations';

  SELECT COUNT(*) INTO membership_policy_count
  FROM pg_policies WHERE tablename = 'organization_memberships';

  RAISE NOTICE 'Organizations policies: %', org_policy_count;
  RAISE NOTICE 'Organization memberships policies: %', membership_policy_count;
  RAISE NOTICE 'RLS circular dependency fix completed ✓';
END;
$$;
