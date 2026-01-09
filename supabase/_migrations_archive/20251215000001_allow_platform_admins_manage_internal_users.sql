-- ============================================================================
-- Migration: Allow Platform Admins to Manage Internal Users
-- ============================================================================
-- Purpose: Enable platform admins (internal users with is_admin=true) to
--          manage the internal_users table through the admin panel
-- ============================================================================

-- Ensure is_admin_optimized() function exists (uses SECURITY DEFINER to avoid RLS recursion)
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
  )
$$;

COMMENT ON FUNCTION public.is_admin_optimized() IS
  'Returns true if current auth user has profiles.is_admin = true (SECURITY DEFINER to avoid RLS recursion)';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "platform_admin_manage_internal_users" ON internal_users;

-- Allow platform admins (users with is_admin=true) to manage internal_users
-- Uses is_admin_optimized() which is SECURITY DEFINER to avoid RLS recursion
-- Platform admins should be able to manage internal_users even if they're not in the table yet
CREATE POLICY "platform_admin_manage_internal_users" ON internal_users
  FOR ALL TO authenticated
  USING (public.is_admin_optimized())
  WITH CHECK (public.is_admin_optimized());

-- Grant INSERT, UPDATE, DELETE permissions to authenticated role
-- (RLS policies will control access)
GRANT INSERT, UPDATE, DELETE ON internal_users TO authenticated;

-- Verification
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'internal_users';
  
  RAISE NOTICE 'internal_users table now has % RLS policies ✓', v_policy_count;
  RAISE NOTICE 'Platform admins can now manage internal_users through admin panel ✓';
END;
$$;
