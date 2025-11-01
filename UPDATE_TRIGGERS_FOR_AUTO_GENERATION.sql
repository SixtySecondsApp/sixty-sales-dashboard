-- ============================================================================
-- CRITICAL: Update trigger functions to use system_config table
-- ============================================================================
-- This fixes automatic suggestion generation when Fathom syncs transcripts
-- Run this in Supabase SQL Editor

-- Update async function (used by triggers)
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
  -- Use system_config table instead of current_setting
  edge_function_url := get_system_config('supabase_url') || '/functions/v1/suggest-next-actions';

  -- Call using extensions schema (where pg_net is installed)
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

  RAISE NOTICE 'Queued next-action suggestion: activity=% type=% request_id=%',
    p_activity_id, p_activity_type, request_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to queue next-action suggestion: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the update
SELECT 'Trigger functions updated successfully!' as status;

-- Test it works
SELECT 'Testing trigger function...' as status;

DO $$
DECLARE
  test_meeting_id UUID;
BEGIN
  -- Find a meeting with transcript
  SELECT id INTO test_meeting_id
  FROM meetings
  WHERE transcript_text IS NOT NULL
  LIMIT 1;

  IF test_meeting_id IS NOT NULL THEN
    -- Trigger the UPDATE to test automatic generation
    UPDATE meetings
    SET updated_at = NOW()
    WHERE id = test_meeting_id;

    RAISE NOTICE 'Triggered automatic generation for meeting: %', test_meeting_id;
    RAISE NOTICE 'Check suggestions in 10-15 seconds with:';
    RAISE NOTICE 'SELECT COUNT(*) FROM next_action_suggestions WHERE activity_id = ''%''', test_meeting_id;
  ELSE
    RAISE NOTICE 'No meetings with transcripts found for testing';
  END IF;
END $$;
