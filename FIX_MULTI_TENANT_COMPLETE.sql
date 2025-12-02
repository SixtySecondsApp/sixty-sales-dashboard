-- =====================================================
-- COMPLETE FIX: Multi-Tenant Setup
-- =====================================================
-- Run this to fix all issues with the multi-tenant setup:
-- 1. RLS recursion on organization_memberships
-- 2. Trigger using wrong column names (full_name vs first_name/last_name)
-- 3. Simplify policies to avoid any recursion

-- =====================================================
-- STEP 1: Drop all existing policies to start fresh
-- =====================================================

DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view own memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view org memberships" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can add members" ON organization_memberships;
DROP POLICY IF EXISTS "Org admins can add members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can update members" ON organization_memberships;
DROP POLICY IF EXISTS "Org admins can update members" ON organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Org admins can remove members" ON organization_memberships;
DROP POLICY IF EXISTS "Users can view invitations in their organizations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can create invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can update invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Owners and admins can delete invitations" ON organization_invitations;
DROP POLICY IF EXISTS "Users can view their own pending invitations" ON organization_invitations;

-- =====================================================
-- STEP 2: Recreate helper functions with SECURITY DEFINER
-- =====================================================

-- Check if user is super admin (queries profiles, not org tables)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get user's role in organization - SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION get_org_role(p_user_id UUID, p_org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is member of organization - SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get all org IDs for a user - SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY SELECT org_id FROM organization_memberships WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 3: Create SIMPLE non-recursive RLS policies
-- =====================================================

-- Organizations: Users can see orgs they're members of
CREATE POLICY "org_select_policy" ON organizations FOR SELECT
USING (
  id IN (SELECT get_user_org_ids(auth.uid()))
  OR is_super_admin(auth.uid())
);

CREATE POLICY "org_all_admin" ON organizations FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Memberships: Simple direct check - can see own membership
CREATE POLICY "membership_select_own" ON organization_memberships FOR SELECT
USING (user_id = auth.uid());

-- Memberships: Can see other members in same org (uses SECURITY DEFINER function)
CREATE POLICY "membership_select_org" ON organization_memberships FOR SELECT
USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

-- Memberships: Admins can manage
CREATE POLICY "membership_insert" ON organization_memberships FOR INSERT
WITH CHECK (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "membership_update" ON organization_memberships FOR UPDATE
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "membership_delete" ON organization_memberships FOR DELETE
USING (
  (get_org_role(auth.uid(), org_id) IN ('owner', 'admin') AND user_id != auth.uid())
  OR is_super_admin(auth.uid())
);

-- Invitations policies
CREATE POLICY "invitation_select" ON organization_invitations FOR SELECT
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
  OR (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) AND accepted_at IS NULL)
);

CREATE POLICY "invitation_insert" ON organization_invitations FOR INSERT
WITH CHECK (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "invitation_update" ON organization_invitations FOR UPDATE
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

CREATE POLICY "invitation_delete" ON organization_invitations FOR DELETE
USING (
  get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  OR is_super_admin(auth.uid())
);

-- =====================================================
-- STEP 4: Fix the organization creation trigger
-- =====================================================

DROP TRIGGER IF EXISTS trigger_auto_org_for_new_user ON profiles;
DROP FUNCTION IF EXISTS auto_create_org_for_new_user();

CREATE OR REPLACE FUNCTION auto_create_org_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Check if user already has an organization membership
  IF EXISTS (SELECT 1 FROM organization_memberships WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Build full name from first_name and last_name (correct columns!)
  v_full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));

  -- Generate org name
  IF LENGTH(v_full_name) > 1 THEN
    v_org_name := v_full_name || '''s Organization';
  ELSIF NEW.email IS NOT NULL AND NEW.email LIKE '%@%' THEN
    v_org_name := INITCAP(SPLIT_PART(SPLIT_PART(NEW.email, '@', 2), '.', 1));
  ELSE
    v_org_name := 'My Organization';
  END IF;

  -- Create organization
  INSERT INTO organizations (name, created_by, is_active)
  VALUES (v_org_name, NEW.id, true)
  RETURNING id INTO v_org_id;

  -- Add user as owner
  INSERT INTO organization_memberships (org_id, user_id, role)
  VALUES (v_org_id, NEW.id, 'owner');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Org creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;  -- Don't fail signup if org creation fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_org_for_new_user
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_org_for_new_user();

-- =====================================================
-- STEP 5: Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_role(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_org_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_create_org_for_new_user() TO service_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Complete multi-tenant fix applied!' as status,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'organizations') as org_policies,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'organization_memberships') as membership_policies,
       (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'organization_invitations') as invitation_policies;
