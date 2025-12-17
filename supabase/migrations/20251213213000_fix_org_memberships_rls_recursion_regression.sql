-- ============================================================================
-- Fix org loading failures (PostgREST 500) caused by recursive RLS policies
-- Regression fix: 20251213130000_ensure_organization_memberships_table.sql
-- reintroduced self-referential EXISTS(...) policies on organization_memberships.
--
-- Symptoms in app:
-- - GET /rest/v1/org_call_types?... returns 500
-- - GET /rest/v1/pipeline_automation_rules?... returns 500
-- - GET /rest/v1/meeting_workflow_results?... returns 500
-- Root cause:
-- - RLS evaluation on organization_memberships recurses into itself.
--
-- This migration re-applies the non-recursive policy set using SECURITY DEFINER
-- helper functions (idempotent) to keep org checks safe.
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
-- Helper: check is_admin via profiles (SECURITY DEFINER)
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
-- Helper: org membership + role (SECURITY DEFINER)
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

-- Ensure RLS enabled (idempotent)
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

-- Drop older policy names used in previous migrations
DROP POLICY IF EXISTS "memberships_select_own" ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_insert_allowed" ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_update_by_admins" ON public.organization_memberships;
DROP POLICY IF EXISTS "memberships_delete_by_admins" ON public.organization_memberships;
DROP POLICY IF EXISTS "users_view_org_memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "users_view_own_memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "select_memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "select_own_memberships" ON public.organization_memberships;

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
-- Keep org selection safe + predictable for members/admins
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
DROP POLICY IF EXISTS "organizations_delete" ON public.organizations;
DROP POLICY IF EXISTS "orgs_select_for_members" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "orgs_update_by_admins" ON public.organizations;
DROP POLICY IF EXISTS "orgs_delete_by_owner" ON public.organizations;

CREATE POLICY "organizations_select"
  ON public.organizations
  FOR SELECT
  USING (
    public.is_service_role()
    OR public.is_admin_optimized()
    OR public.is_org_member(auth.uid(), id)
    OR created_by = auth.uid()
  );

-- Allow any authenticated user to create orgs (onboarding)
CREATE POLICY "organizations_insert"
  ON public.organizations
  FOR INSERT
  WITH CHECK (
    public.is_service_role()
    OR auth.uid() IS NOT NULL
  );

-- Owners/admins (or platform admins) can update org settings
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





