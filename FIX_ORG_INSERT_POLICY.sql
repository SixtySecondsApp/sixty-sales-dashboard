-- =====================================================
-- FIX: Allow authenticated users to create organizations
-- =====================================================
-- The RLS policy was missing an INSERT policy for regular users.
-- Users need to be able to create their first organization during onboarding.
--
-- Run this in Supabase SQL Editor.

-- 1. Add INSERT policy for authenticated users to create organizations
-- Users can create an organization where they set themselves as the creator
CREATE POLICY "org_insert_authenticated" ON organizations FOR INSERT
TO authenticated
WITH CHECK (
  -- User must set themselves as the creator
  created_by = auth.uid()
);

-- 2. Also need to allow users to add themselves as owner when creating an org
-- Currently membership_insert requires being owner/admin of the org, which doesn't work
-- for the first membership. Let's add a policy for self-insert as owner.
DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;

CREATE POLICY "membership_insert" ON organization_memberships FOR INSERT
TO authenticated
WITH CHECK (
  -- Can add yourself as owner to an org you created
  (user_id = auth.uid() AND role = 'owner' AND EXISTS (
    SELECT 1 FROM organizations WHERE id = org_id AND created_by = auth.uid()
  ))
  -- Or existing org admins can add members
  OR get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  -- Or super admins can do anything
  OR is_super_admin(auth.uid())
);

-- 3. Verify policies are in place
SELECT
  polname as policy_name,
  polcmd as command,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as operation
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY polname;

SELECT 'Organization INSERT policy added!' as status;
