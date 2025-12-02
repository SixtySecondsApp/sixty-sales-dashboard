-- =====================================================
-- Fix: Allow authenticated users to create organizations
-- =====================================================
-- The RLS policy was missing an INSERT policy for regular users.
-- Users need to be able to create their first organization during onboarding.

-- 1. Add INSERT policy for authenticated users to create organizations
-- Users can create an organization where they set themselves as the creator
DO $$
BEGIN
  -- Drop if exists to avoid conflicts
  DROP POLICY IF EXISTS "org_insert_authenticated" ON organizations;

  CREATE POLICY "org_insert_authenticated" ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must set themselves as the creator
    created_by = auth.uid()
  );

  RAISE NOTICE 'Created org_insert_authenticated policy';
END $$;

-- 2. Update membership INSERT policy to allow self-insert as owner
DO $$
BEGIN
  -- Drop existing policy
  DROP POLICY IF EXISTS "membership_insert" ON organization_memberships;

  -- Create new policy that allows:
  -- a) Self-insert as owner for orgs you created
  -- b) Existing admins to add members
  -- c) Super admins to do anything
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

  RAISE NOTICE 'Updated membership_insert policy';
END $$;
