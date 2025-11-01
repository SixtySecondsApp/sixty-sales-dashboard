#!/bin/bash

# Apply the trigger function updates directly

echo "Applying trigger function updates..."

psql "$DATABASE_URL" << 'EOF'

-- Update async function to use system_config
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

SELECT 'Updated call_suggest_next_actions_async function' as status;

EOF

echo "Done!"
