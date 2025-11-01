-- Fix http_post function signature
-- The actual pg_net signature is:
-- http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer)

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
  v_user_id := get_user_id_from_activity(p_activity_id, p_activity_type);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Cannot determine user_id for activity');
  END IF;

  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- Correct signature: http_post(url, body, params, headers, timeout)
  SELECT status, body INTO response_status, response_body
  FROM net.http_post(
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
  );

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

-- Also update async function
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
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- Correct signature: http_post(url, body, params, headers, timeout)
  SELECT net.http_post(
    url := edge_function_url,
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', p_user_id,
      'forceRegenerate', false
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || get_system_config('service_role_key')
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  RAISE NOTICE 'Queued next-action suggestion generation: activity=% type=% request_id=%',
    p_activity_id, p_activity_type, request_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to queue next-action suggestion: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
