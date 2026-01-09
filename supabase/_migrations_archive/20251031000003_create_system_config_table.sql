-- Create system configuration table as alternative to database settings
-- This allows storing config without requiring ALTER DATABASE permissions

-- Create config table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write config
CREATE POLICY "Service role can manage config"
  ON system_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default config values (will be updated via SQL or function)
INSERT INTO system_config (key, value, description)
VALUES
  ('supabase_url', 'https://placeholder.supabase.co', 'Supabase project URL for Edge Function calls'),
  ('service_role_key', 'placeholder-key', 'Service role key for authenticating Edge Function calls')
ON CONFLICT (key) DO NOTHING;

-- Helper function to get config value
CREATE OR REPLACE FUNCTION get_system_config(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT value FROM system_config WHERE key = p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to set config value (service_role only)
CREATE OR REPLACE FUNCTION set_system_config(p_key TEXT, p_value TEXT, p_description TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO system_config (key, value, description, updated_at)
  VALUES (p_key, p_value, p_description, NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, system_config.description),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON system_config TO authenticated;
GRANT ALL ON system_config TO service_role;
GRANT EXECUTE ON FUNCTION get_system_config TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_system_config TO service_role;

-- Update existing functions to use system_config table instead of app.settings
CREATE OR REPLACE FUNCTION call_suggest_next_actions_async(
  p_activity_id UUID,
  p_activity_type TEXT,
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  edge_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Get config from system_config table
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- Make async HTTP request using pg_net
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_system_config('service_role_key')
    ),
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', p_user_id,
      'forceRegenerate', false
    )
  ) INTO request_id;

  RAISE NOTICE 'Queued next-action suggestion generation: activity=% type=% request_id=%',
    p_activity_id, p_activity_type, request_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to queue next-action suggestion: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION regenerate_next_actions_for_activity(
  p_activity_id UUID,
  p_activity_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  edge_function_url TEXT;
  response_body TEXT;
  response_status INTEGER;
BEGIN
  -- Get user_id
  v_user_id := get_user_id_from_activity(p_activity_id, p_activity_type);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Cannot determine user_id for activity');
  END IF;

  -- Get config from system_config table
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- Make synchronous HTTP request for manual regeneration
  SELECT status, body INTO response_status, response_body
  FROM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_system_config('service_role_key')
    ),
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', v_user_id,
      'forceRegenerate', true
    )::text,
    timeout_milliseconds := 30000
  );

  -- Return response
  RETURN json_build_object(
    'status', response_status,
    'response', response_body::json
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', 'Failed to regenerate suggestions',
    'details', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON TABLE system_config IS 'System configuration values accessible to triggers and functions without requiring ALTER DATABASE permissions';
