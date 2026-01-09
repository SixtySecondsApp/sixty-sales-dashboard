-- Migration: Add get_my_google_integration RPC function
-- Purpose: Fixes 404 errors when checking Google integration status
-- The RPC approach bypasses the 406 header issue with direct REST API calls

-- Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS get_user_google_integration(UUID);
DROP FUNCTION IF EXISTS get_my_google_integration();

-- Create an RPC function to get user's Google integration by user_id
-- This is useful for service-role access
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

-- Create a simpler version that uses auth.uid() for client-side calls
-- This is the primary function called by the frontend
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
