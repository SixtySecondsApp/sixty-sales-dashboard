-- Migration: Add fuzzy organization search function
-- Allows finding similar organizations by name for duplicate detection

-- Function to find similar organization names using fuzzy matching
CREATE OR REPLACE FUNCTION "public"."find_similar_organizations"(
  p_search_name text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  name text,
  company_domain text,
  member_count bigint,
  similarity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.company_domain,
    COUNT(om.user_id) as member_count,
    -- Calculate similarity score based on:
    -- 1. Case-insensitive exact match
    -- 2. ILIKE pattern matching
    -- 3. Word overlap
    CASE
      WHEN LOWER(o.name) = LOWER(p_search_name) THEN 1.0
      WHEN LOWER(o.name) LIKE LOWER('%' || p_search_name || '%') THEN 0.8
      WHEN LOWER(p_search_name) LIKE LOWER('%' || o.name || '%') THEN 0.7
      ELSE 0.5
    END::float as similarity_score
  FROM organizations o
  LEFT JOIN organization_memberships om ON o.id = om.org_id
  WHERE
    o.is_active = true
    AND (
      -- Exact match (case-insensitive)
      LOWER(o.name) = LOWER(p_search_name)
      -- Partial match
      OR LOWER(o.name) LIKE LOWER('%' || p_search_name || '%')
      OR LOWER(p_search_name) LIKE LOWER('%' || o.name || '%')
      -- Word similarity (if you have pg_trgm extension)
      -- OR similarity(LOWER(o.name), LOWER(p_search_name)) > 0.3
    )
  GROUP BY o.id, o.name, o.company_domain
  HAVING COUNT(om.user_id) > 0  -- Only show orgs with at least 1 member
  ORDER BY similarity_score DESC, member_count DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_similar_organizations(text, int) TO authenticated;
