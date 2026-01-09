-- Create session context functions for audit logging
-- This allows the frontend to set session context that can be used in triggers

-- Function to set configuration variables (avoid conflict with built-in set_config)
CREATE OR REPLACE FUNCTION set_app_config(
  setting_name TEXT,
  setting_value TEXT,
  is_local BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the configuration variable using built-in PostgreSQL function
  PERFORM set_config(setting_name, setting_value, is_local);
  
  -- Return success message
  RETURN 'Configuration set: ' || setting_name || ' = ' || setting_value;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error message but don't fail
    RETURN 'Failed to set configuration: ' || SQLERRM;
END;
$$;

-- Function to get configuration variables
CREATE OR REPLACE FUNCTION get_config(
  setting_name TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get the configuration variable
  RETURN current_setting(setting_name, true);
EXCEPTION
  WHEN OTHERS THEN
    -- Return null if setting doesn't exist
    RETURN NULL;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION set_app_config(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_config(TEXT) TO authenticated;

-- Also grant to anon for cases where users might not be authenticated yet
GRANT EXECUTE ON FUNCTION set_app_config(TEXT, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION get_config(TEXT) TO anon;