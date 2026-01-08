-- Create an RPC function to get user's Google integration
-- This bypasses the 406 header issue with direct REST API calls
CREATE OR REPLACE FUNCTION get_user_google_integration(p_user_id UUID)
RETURNS SETOF google_integrations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM google_integrations
    WHERE user_id = p_user_id
    AND is_active = true
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_google_integration(UUID) TO authenticated;