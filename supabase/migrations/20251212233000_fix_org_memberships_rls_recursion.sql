-- ============================================================================
-- Fix org loading failures (PostgREST 500) caused by recursive RLS policies
-- ============================================================================
-- Symptoms observed in the app:
-- - GET /rest/v1/organization_memberships?... returns 500
-- - OrgContext cannot load orgs -> platform/admin pages break
--
-- Root cause (common):
-- - RLS policy on organization_memberships referencing organization_memberships
--   via EXISTS(...) can trigger "infinite recursion detected in policy"
--
-- This migration:
-- - Adds small helper functions (idempotent) used by many policies
-- - Replaces organization_memberships + organizations policies with non-recursive versions
-- ============================================================================

-- ------------------------------------------------------------
-- Helper: detect service_role from JWT claims
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role';
$$;

COMMENT ON FUNCTION public.is_service_role() IS 'Returns true if the current request JWT role is service_role';

-- ------------------------------------------------------------
-- Helper: check is_admin via profiles (SECURITY DEFINER to avoid RLS issues)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_optimized()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_optimized() IS 'Returns true if current auth user has profiles.is_admin = true';

-- ------------------------------------------------------------
-- Helper: org membership + role (SECURITY DEFINER, used by policies)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE user_id = p_user_id
      AND org_id = p_org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(p_user_id uuid, p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.organization_memberships
  WHERE user_id = p_user_id
    AND org_id = p_org_id
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS 'Checks if a user is a member of an organization (SECURITY DEFINER)';
COMMENT ON FUNCTION public.get_org_role(uuid, uuid) IS 'Gets a user role in an organization (SECURITY DEFINER)';

-- Ensure RLS is enabled (idempotent)
ALTER TABLE IF EXISTS public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- TABLE: organization_memberships
-- Replace policies with non-recursive versions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "organization_memberships_select" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_insert" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_update" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_delete" ON public.organization_memberships;

-- Also drop older policy names seen in earlier migrations
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON public.organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can update members" ON public.organization_memberships;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.organization_memberships;
DROP POLICY IF EXISTS "organization_memberships_select_own" ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_select_own" ON public.organization_memberships;

CREATE POLICY "organization_memberships_select"
  ON public.organization_memberships
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR user_id = auth.uid()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

CREATE POLICY "organization_memberships_insert"
  ON public.organization_memberships
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    -- Allow users to add themselves as owner to orgs they created
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND EXISTS (
        SELECT 1
        FROM public.organizations o
        WHERE o.id = org_id
          AND o.created_by = auth.uid()
      )
    )
    -- Allow users to add themselves as member (joining)
    OR (
      user_id = auth.uid()
      AND role = 'member'
    )
    -- Org owners/admins can add members
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

CREATE POLICY "organization_memberships_update"
  ON public.organization_memberships
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

CREATE POLICY "organization_memberships_delete"
  ON public.organization_memberships
  FOR DELETE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR user_id = auth.uid()
    OR public.get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
  );

-- ------------------------------------------------------------
-- TABLE: organizations
-- Make org selection safe + predictable for members/admins
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;

-- Also drop older names
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Super admins can manage all organizations" ON public.organizations;

CREATE POLICY "organizations_select"
  ON public.organizations
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.is_org_member(auth.uid(), id)
  );

-- Allow any authenticated user to create orgs (onboarding)
CREATE POLICY "organizations_insert"
  ON public.organizations
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR auth.uid() IS NOT NULL
  );

-- Owners/admins (or platform admins) can update/delete org settings
CREATE POLICY "organizations_update"
  ON public.organizations
  FOR UPDATE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), id) IN ('owner', 'admin')
  );

CREATE POLICY "organizations_delete"
  ON public.organizations
  FOR DELETE
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.get_org_role(auth.uid(), id) = 'owner'
  );






