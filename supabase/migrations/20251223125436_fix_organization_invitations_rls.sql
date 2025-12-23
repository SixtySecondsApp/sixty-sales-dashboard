-- ============================================================================
-- Migration: Fix Organization Invitations RLS Policy
-- ============================================================================
-- Problem: The INSERT policy only allows service_role, blocking org admins
-- from inviting team members during onboarding.
--
-- Fix: Allow org owners and admins to create invitations for their org.
-- ============================================================================

-- Drop the overly restrictive INSERT policy
DROP POLICY IF EXISTS "organization_invitations_insert" ON organization_invitations;

-- Create new INSERT policy that allows org admins to invite
CREATE POLICY "organization_invitations_insert" ON organization_invitations
FOR INSERT WITH CHECK (
  -- Service role can always insert (for system operations)
  is_service_role()
  -- Org owners and admins can invite to their organization
  OR can_admin_org(org_id)
);

-- Also ensure the helper function exists (it should, but verify)
DO $$
BEGIN
  -- Verify can_admin_org exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'can_admin_org'
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'can_admin_org function not found - please run the org helper functions migration first';
  END IF;

  RAISE NOTICE 'organization_invitations INSERT policy fixed successfully';
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT ON organization_invitations TO authenticated;
