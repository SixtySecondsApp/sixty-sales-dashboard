-- ============================================================================
-- Migration: Allow Admins to Delete Profiles
-- ============================================================================
-- Updates the profiles_delete RLS policy to allow platform admins to delete
-- user profiles, not just the service role
-- ============================================================================
-- Note: This uses DROP POLICY IF EXISTS which is safe - it only removes the
-- access rule definition, not any data. Policies are just security rules.
-- ============================================================================

-- Update the delete policy to allow admins
-- Using IF EXISTS ensures it's safe even if policy doesn't exist yet
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Create the policy with admin access
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (
    is_service_role()
    OR is_admin_optimized()
  );

COMMENT ON POLICY "profiles_delete" ON profiles IS
  'Allows service role and platform admins to delete profiles. Regular users cannot delete profiles.';
