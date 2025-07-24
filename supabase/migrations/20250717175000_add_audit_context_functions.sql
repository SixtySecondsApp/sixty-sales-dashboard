-- Add helper functions to set and manage audit context for impersonation tracking

-- Function to set audit context parameters
CREATE OR REPLACE FUNCTION set_audit_context(
  p_original_user_id UUID DEFAULT NULL,
  p_impersonated_user_id UUID DEFAULT NULL,
  p_is_impersonating BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  -- Set the context variables that the audit trigger will read
  PERFORM set_config('app.original_user_id', COALESCE(p_original_user_id::text, ''), false);
  PERFORM set_config('app.impersonated_user_id', COALESCE(p_impersonated_user_id::text, ''), false);
  PERFORM set_config('app.is_impersonating', p_is_impersonating::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear audit context
CREATE OR REPLACE FUNCTION clear_audit_context()
RETURNS VOID AS $$
BEGIN
  -- Clear all audit context variables
  PERFORM set_config('app.original_user_id', '', false);
  PERFORM set_config('app.impersonated_user_id', '', false);
  PERFORM set_config('app.is_impersonating', 'false', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current audit context
CREATE OR REPLACE FUNCTION get_current_audit_context()
RETURNS TABLE (
  original_user_id UUID,
  impersonated_user_id UUID,
  is_impersonating BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN current_setting('app.original_user_id', true) = '' THEN NULL
      ELSE current_setting('app.original_user_id', true)::UUID
    END as original_user_id,
    CASE 
      WHEN current_setting('app.impersonated_user_id', true) = '' THEN NULL
      ELSE current_setting('app.impersonated_user_id', true)::UUID
    END as impersonated_user_id,
    COALESCE(current_setting('app.is_impersonating', true)::BOOLEAN, false) as is_impersonating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION set_audit_context TO authenticated;
GRANT EXECUTE ON FUNCTION clear_audit_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_audit_context TO authenticated;

-- Add comments to document the functions
COMMENT ON FUNCTION set_audit_context IS 'Sets the impersonation context for audit logging. Should be called before database operations during impersonation.';
COMMENT ON FUNCTION clear_audit_context IS 'Clears the impersonation context. Should be called after database operations or when ending impersonation.';
COMMENT ON FUNCTION get_current_audit_context IS 'Returns the current impersonation context for debugging and verification purposes.';