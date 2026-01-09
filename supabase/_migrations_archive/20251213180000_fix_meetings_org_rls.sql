-- Fix meetings RLS to allow org members to see team meetings
-- Currently users can only see their own meetings - this adds org-based access

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "meetings_select_own" ON meetings;
DROP POLICY IF EXISTS "meetings_select_own_and_org" ON meetings;

-- Create new policy that allows:
-- 1. Users to see their own meetings (owner_user_id matches)
-- 2. Users to see meetings from their org (same org_id AND user is member of that org)
-- 3. Admins to see all meetings
--
-- Uses is_org_member() SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "meetings_select_own_and_org" ON meetings
    FOR SELECT USING (
        -- Own meetings
        owner_user_id = current_user_id()
        OR
        -- Org-based access: user is a member of the meeting's organization
        -- Uses SECURITY DEFINER function to avoid recursion with organization_memberships RLS
        (
            org_id IS NOT NULL
            AND public.is_org_member(current_user_id(), org_id)
        )
        OR
        -- Admin access
        is_current_user_admin()
    );

-- Add index to optimize org-based queries if not exists
CREATE INDEX IF NOT EXISTS idx_meetings_org_id ON meetings(org_id);

-- Add a comment explaining the policy
COMMENT ON POLICY "meetings_select_own_and_org" ON meetings IS
    'Allows users to view their own meetings, meetings from their organization, or all meetings if admin';
