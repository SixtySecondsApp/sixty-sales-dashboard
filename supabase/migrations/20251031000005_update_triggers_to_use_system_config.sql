-- Update trigger functions to use system_config table instead of current_setting

-- ============================================================================
-- Update async function to use system_config
-- ============================================================================

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

-- ============================================================================
-- Update manual regeneration function to use system_config
-- ============================================================================

CREATE OR REPLACE FUNCTION regenerate_next_actions_for_activity(
  p_activity_id UUID,
  p_activity_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  edge_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Get user_id
  v_user_id := get_user_id_from_activity(p_activity_id, p_activity_type);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Cannot determine user_id for activity');
  END IF;

  -- Get config from system_config table
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- pg_net.http_post returns a request_id, not the response
  -- The request is async, response comes later
  SELECT extensions.http_post(
    url := edge_function_url,
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', v_user_id,
      'forceRegenerate', true
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_system_config('service_role_key')
    ),
    timeout_milliseconds := 30000
  ) INTO request_id;

  -- Return the request_id
  -- The actual Edge Function will run async and create suggestions
  RETURN json_build_object(
    'success', true,
    'request_id', request_id,
    'message', 'Suggestion generation queued'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'error', 'Failed to regenerate suggestions',
    'details', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION call_suggest_next_actions_async IS
  'Updated to use system_config table and extensions.http_post (pg_net in extensions schema)';

COMMENT ON FUNCTION regenerate_next_actions_for_activity IS
  'Updated to use system_config table and extensions.http_post (pg_net in extensions schema)';
