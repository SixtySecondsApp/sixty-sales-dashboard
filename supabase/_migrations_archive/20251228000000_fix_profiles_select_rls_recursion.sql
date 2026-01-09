-- ============================================================================
-- Migration: Fix profiles_select RLS policy recursion
-- ============================================================================
-- Problem:
--   The profiles_select policy (from 20251221000004) has an EXISTS clause that
--   directly queries organization_memberships. This causes RLS recursion:
--   profiles_select → organization_memberships → organization_memberships_select
--   → get_org_role() → potentially back to profiles via is_admin_optimized()
--
-- Symptom:
--   PostgREST queries to profiles fail with 400 Bad Request
--
-- Fix:
--   Create a SECURITY DEFINER function to check if two users share an org,
--   then use that function in the profiles_select policy to bypass RLS recursion.
-- ============================================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper: Check if two users share any organization
-- Uses SECURITY DEFINER to bypass RLS and avoid recursion
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_share_organization(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om_a
    INNER JOIN public.organization_memberships om_b
      ON om_a.org_id = om_b.org_id
    WHERE om_a.user_id = user_a
      AND om_b.user_id = user_b
      AND om_a.user_id != om_b.user_id
  );
$$;

COMMENT ON FUNCTION public.users_share_organization(uuid, uuid) IS
  'Returns true if two users share at least one organization (SECURITY DEFINER to bypass RLS)';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.users_share_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_organization(uuid, uuid) TO service_role;

-- ------------------------------------------------------------
-- Update profiles_select policy to use the helper function
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (
    -- Service role can see all
    public.is_service_role()
    -- User can see their own profile
    OR id = auth.uid()
    -- Admins can see all profiles
    OR public.is_admin_optimized()
    -- Users can see profiles of others in the same org(s)
    -- Using SECURITY DEFINER function to avoid RLS recursion
    OR public.users_share_organization(auth.uid(), id)
  );

COMMENT ON POLICY "profiles_select" ON profiles IS
  'Allows users to see their own profile, profiles of users in the same organization(s), and all profiles if admin. Uses SECURITY DEFINER helper to avoid RLS recursion.';

COMMIT;
