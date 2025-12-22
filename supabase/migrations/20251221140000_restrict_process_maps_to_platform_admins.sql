-- ============================================================================
-- Migration: Restrict process_maps to platform admins only
-- ============================================================================
-- Issue: Process maps should only be visible to platform admins (internal + is_admin)
-- Previously: Any org member could view, org admins could manage
-- Now: Only platform admins (internal users with is_admin = true) can access
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "org_members_view_process_maps" ON public.process_maps;
DROP POLICY IF EXISTS "org_admins_insert_process_maps" ON public.process_maps;
DROP POLICY IF EXISTS "org_admins_update_process_maps" ON public.process_maps;
DROP POLICY IF EXISTS "org_admins_delete_process_maps" ON public.process_maps;

-- Helper function to check if user is a platform admin (internal + is_admin)
-- This is more efficient than checking both tables in every policy
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN internal_users iu ON lower(p.email) = lower(iu.email)
    WHERE p.id = auth.uid()
      AND p.is_admin = true
      AND iu.is_active = true
  )
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- New policies: Platform admins only
CREATE POLICY "platform_admins_view_process_maps" ON public.process_maps
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

CREATE POLICY "platform_admins_insert_process_maps" ON public.process_maps
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

CREATE POLICY "platform_admins_update_process_maps" ON public.process_maps
    FOR UPDATE
    TO authenticated
    USING (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

CREATE POLICY "platform_admins_delete_process_maps" ON public.process_maps
    FOR DELETE
    TO authenticated
    USING (
        public.is_platform_admin()
        OR auth.role() = 'service_role'
    );

-- Update table comment
COMMENT ON TABLE public.process_maps IS 'Stores AI-generated Mermaid process visualization charts for integrations and workflows. Platform admin access only.';
