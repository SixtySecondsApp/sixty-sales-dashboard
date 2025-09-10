-- Drop the function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS get_user_google_integration(UUID);

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

-- Also create a simpler version that uses auth.uid()
DROP FUNCTION IF EXISTS get_my_google_integration();

CREATE OR REPLACE FUNCTION get_my_google_integration()
RETURNS TABLE(
    id UUID,
    user_id UUID,
    email TEXT,
    expires_at TIMESTAMPTZ,
    scopes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.id,
        gi.user_id,
        gi.email,
        gi.expires_at,
        gi.scopes,
        gi.is_active,
        gi.created_at,
        gi.updated_at
    FROM google_integrations gi
    WHERE gi.user_id = auth.uid()
    AND gi.is_active = true
    LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_my_google_integration() TO authenticated;