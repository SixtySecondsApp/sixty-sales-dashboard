-- Fix pg_net schema reference
-- pg_net was installed in 'extensions' schema, not 'net' schema
-- Update all functions to use extensions.http_post instead of net.http_post

-- Update async function
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

  -- Make async HTTP request using pg_net (in extensions schema)
  SELECT extensions.http_post(
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

-- Update sync function
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

  -- Make synchronous HTTP request using pg_net (in extensions schema)
  SELECT status, body INTO response_status, response_body
  FROM extensions.http_post(
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

-- Grant permissions on extensions schema
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

-- Add comment
COMMENT ON FUNCTION call_suggest_next_actions_async IS
  'Updated to use extensions.http_post (pg_net installed in extensions schema)';

COMMENT ON FUNCTION regenerate_next_actions_for_activity IS
  'Updated to use extensions.http_post (pg_net installed in extensions schema)';
