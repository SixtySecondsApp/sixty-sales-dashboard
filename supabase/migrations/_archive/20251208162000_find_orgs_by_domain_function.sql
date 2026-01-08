-- ============================================================================
-- Migration: Find Organizations by Email Domain
-- ============================================================================
-- Purpose: Allow users to find existing organizations where members share
-- their email domain, enabling them to join their team's org.
-- ============================================================================

-- Function to find organizations with members matching an email domain
CREATE OR REPLACE FUNCTION find_orgs_by_email_domain(
  p_domain TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    COUNT(DISTINCT om.user_id)::BIGINT as member_count
  FROM organizations o
  INNER JOIN organization_memberships om ON o.id = om.org_id
  INNER JOIN auth.users u ON om.user_id = u.id
  WHERE
    -- Match domain (case-insensitive)
    LOWER(SPLIT_PART(u.email, '@', 2)) = LOWER(p_domain)
    -- Exclude orgs the requesting user is already a member of
    AND o.id NOT IN (
      SELECT org_id FROM organization_memberships WHERE user_id = p_user_id
    )
    -- Only active organizations
    AND o.is_active = true
  GROUP BY o.id, o.name
  -- Only return orgs with at least one member from this domain
  HAVING COUNT(DISTINCT om.user_id) > 0
  ORDER BY COUNT(DISTINCT om.user_id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_orgs_by_email_domain(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_orgs_by_email_domain(TEXT, UUID) TO service_role;

-- Also update the membership INSERT policy to allow users to join orgs with matching domain
DROP POLICY IF EXISTS "users_join_matching_domain_orgs" ON organization_memberships;
CREATE POLICY "users_join_matching_domain_orgs" ON organization_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is adding themselves
    user_id = auth.uid()
    -- As a member (not owner/admin)
    AND role = 'member'
    -- To an org that has at least one member with matching email domain
    AND EXISTS (
      SELECT 1
      FROM organization_memberships om
      INNER JOIN auth.users u ON om.user_id = u.id
      INNER JOIN auth.users curr ON curr.id = auth.uid()
      WHERE om.org_id = organization_memberships.org_id
        AND LOWER(SPLIT_PART(u.email, '@', 2)) = LOWER(SPLIT_PART(curr.email, '@', 2))
    )
  );

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'find_orgs_by_email_domain function created ✓';
  RAISE NOTICE 'Domain-based org joining policy created ✓';
END;
$$;
