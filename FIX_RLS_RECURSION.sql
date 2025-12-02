-- =====================================================
-- FIX: RLS Policy Recursion on organization_memberships
-- =====================================================
-- The original policy caused infinite recursion by querying
-- the same table in the policy check. This fix uses a simpler
-- approach that checks direct user membership.

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can add members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON organization_memberships;

-- Create non-recursive SELECT policy
-- Users can see memberships where they are a member (direct check, no subquery on same table)
CREATE POLICY "Users can view own memberships"
  ON organization_memberships FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- Users can see other memberships in orgs they belong to
-- This uses a function to avoid recursion
CREATE OR REPLACE FUNCTION user_org_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
  SELECT org_id FROM organization_memberships WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Users can view org memberships"
  ON organization_memberships FOR SELECT
  USING (
    org_id IN (SELECT user_org_ids(auth.uid()))
    OR is_super_admin(auth.uid())
  );

-- INSERT policy - use function to check role
CREATE POLICY "Org admins can add members"
  ON organization_memberships FOR INSERT
  WITH CHECK (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- UPDATE policy
CREATE POLICY "Org admins can update members"
  ON organization_memberships FOR UPDATE
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

-- DELETE policy
CREATE POLICY "Org admins can remove members"
  ON organization_memberships FOR DELETE
  USING (
    (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
    OR is_super_admin(auth.uid())
  );

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION user_org_ids(UUID) TO authenticated;

-- Verification
SELECT 'RLS recursion fix applied!' as status;
