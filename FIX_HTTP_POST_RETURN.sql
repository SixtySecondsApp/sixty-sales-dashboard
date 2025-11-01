-- Fix http_post return value handling
-- pg_net.http_post returns a request_id (bigint), not a result set
-- We need to use http_get to check the response later, or use async pattern

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
  v_user_id := get_user_id_from_activity(p_activity_id, p_activity_type);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Cannot determine user_id for activity');
  END IF;

  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- pg_net.http_post returns a request_id, not the response
  -- The request is async, response comes later
  SELECT net.http_post(
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

-- Update async function (same pattern)
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

  RAISE NOTICE 'Queued next-action suggestion: activity=% type=% request_id=%',
    p_activity_id, p_activity_type, request_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to queue next-action suggestion: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION regenerate_next_actions_for_activity IS
  'Queues async suggestion generation via pg_net. Returns request_id. Edge Function runs in background.';

COMMENT ON FUNCTION call_suggest_next_actions_async IS
  'Async suggestion generation for triggers. Fire and forget pattern.';
