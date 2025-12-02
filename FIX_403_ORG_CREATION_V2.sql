-- =====================================================
-- FIX 403/500 ERROR ON ORGANIZATION CREATION - V2
-- =====================================================
-- This fixes the self-referential policy issue that was causing 500 errors

-- =====================================================
-- STEP 1: Drop ALL existing policies completely
-- =====================================================

DROP POLICY IF EXISTS "org_select" ON organizations;
DROP POLICY IF EXISTS "org_insert" ON organizations;
DROP POLICY IF EXISTS "org_update" ON organizations;
DROP POLICY IF EXISTS "org_delete" ON organizations;
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;
DROP POLICY IF EXISTS "org_update_owner" ON organizations;
DROP POLICY IF EXISTS "org_all_admin" ON organizations;

DROP POLICY IF EXISTS "membership_select" ON organization_memberships;
DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;
DROP POLICY IF EXISTS "membership_update" ON organization_memberships;
DROP POLICY IF EXISTS "membership_delete" ON organization_memberships;
DROP POLICY IF EXISTS "membership_select_own" ON organization_memberships;
DROP POLICY IF EXISTS "membership_select_org" ON organization_memberships;

-- =====================================================
-- STEP 2: Create SECURITY DEFINER helper functions
-- These bypass RLS to avoid circular dependencies
-- =====================================================

-- Check if user is super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
EXCEPTION
  WHEN undefined_table THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's org IDs (bypasses RLS to avoid circular reference)
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT org_id FROM organization_memberships
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is member of org (bypasses RLS)
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's role in org (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_org_role(p_user_id UUID, p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_role(UUID, UUID) TO authenticated;

-- =====================================================
-- STEP 3: Create ORGANIZATIONS policies using helper functions
-- =====================================================

-- SELECT: Use helper function to avoid RLS circular reference
CREATE POLICY "org_select" ON organizations
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (SELECT get_user_org_ids(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- INSERT: Simple policy - user must set themselves as creator
CREATE POLICY "org_insert" ON organizations
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- UPDATE: Creator, owner, or super admin
CREATE POLICY "org_update" ON organizations
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR get_user_org_role(auth.uid(), id) = 'owner'
  OR is_super_admin(auth.uid())
);

-- DELETE: Super admin only
CREATE POLICY "org_delete" ON organizations
FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 4: Create MEMBERSHIP policies using helper functions
-- =====================================================

-- SELECT: Own memberships or same org members
CREATE POLICY "membership_select" ON organization_memberships
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR org_id IN (SELECT get_user_org_ids(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- INSERT: Self as owner for own orgs, or admin adding members
CREATE POLICY "membership_insert" ON organization_memberships
FOR INSERT TO authenticated
WITH CHECK (
  -- Self-insert as owner for orgs you created
  (
    user_id = auth.uid()
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND created_by = auth.uid()
    )
  )
  -- OR you're an owner/admin of the org (use helper function)
  OR get_user_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  -- OR super admin
  OR is_super_admin(auth.uid())
);

-- UPDATE: Owner/admin can update
CREATE POLICY "membership_update" ON organization_memberships
FOR UPDATE TO authenticated
USING (
  get_user_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

-- DELETE: Owner/admin can delete others (not self)
CREATE POLICY "membership_delete" ON organization_memberships
FOR DELETE TO authenticated
USING (
  (
    get_user_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    AND user_id != auth.uid()
  )
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 5: Verify
-- =====================================================

SELECT 'SUCCESS: All policies created!' as status;

SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'organization_memberships')
ORDER BY tablename, policyname;
