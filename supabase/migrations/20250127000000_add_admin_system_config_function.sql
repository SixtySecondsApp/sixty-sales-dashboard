-- Add admin-only function to update system_config
-- This allows admins to update system configuration without requiring service_role

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = p_user_id
      AND (is_admin = true OR role IN ('admin', 'super_admin'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated;

-- Admin-only function to set system config
CREATE OR REPLACE FUNCTION admin_set_system_config(
  p_key TEXT,
  p_value TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if user is admin
  IF NOT is_user_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only administrators can update system configuration';
  END IF;
  
  -- Update or insert system config
  INSERT INTO system_config (key, value, description, updated_at)
  VALUES (p_key, p_value, p_description, NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, system_config.description),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (function will check admin status)
GRANT EXECUTE ON FUNCTION admin_set_system_config TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_set_system_config IS 'Admin-only function to update system configuration. Checks admin status before allowing updates.';















