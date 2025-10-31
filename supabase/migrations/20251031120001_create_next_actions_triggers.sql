-- Migration: Auto-Generate Next Action Suggestions via Database Triggers
-- Description: Automatically invoke Edge Function to generate suggestions after activity creation
-- Author: Claude
-- Date: 2025-10-31
-- Dependencies: Requires pg_net extension and suggest-next-actions Edge Function

-- ============================================================================
-- PHASE 1: Ensure pg_net Extension is Enabled
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- PHASE 2: Helper Function to Call Edge Function Asynchronously
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
  -- Construct Edge Function URL
  edge_function_url := current_setting('app.settings.supabase_url', true) ||
                       '/functions/v1/suggest-next-actions';

  -- Make async HTTP request using pg_net
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', p_user_id,
      'forceRegenerate', false
    )
  ) INTO request_id;

  -- Log the async request (optional)
  RAISE NOTICE 'Queued next-action suggestion generation: activity=% type=% request_id=%',
    p_activity_id, p_activity_type, request_id;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Failed to queue next-action suggestion: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 3: Trigger Function for Meetings
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_suggest_next_actions_for_meeting()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate suggestions for new meetings with transcript or summary
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.transcript_text IS NULL AND NEW.transcript_text IS NOT NULL) THEN

    -- Check if meeting has sufficient context for analysis
    IF NEW.transcript_text IS NOT NULL OR NEW.summary IS NOT NULL THEN

      -- Skip if suggestions were already generated recently (within last hour)
      IF NEW.next_actions_generated_at IS NULL OR
         NEW.next_actions_generated_at < NOW() - INTERVAL '1 hour' THEN

        -- Call Edge Function asynchronously
        PERFORM call_suggest_next_actions_async(
          NEW.id,
          'meeting',
          NEW.owner_user_id
        );

      END IF;

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_suggest_next_actions_meeting ON meetings;

-- Create trigger for meetings (AFTER INSERT/UPDATE to ensure data is committed)
CREATE TRIGGER trigger_auto_suggest_next_actions_meeting
  AFTER INSERT OR UPDATE OF transcript_text, summary ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_suggest_next_actions_for_meeting();

-- ============================================================================
-- PHASE 4: Trigger Function for Activities
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_suggest_next_actions_for_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate suggestions for certain activity types
  IF TG_OP = 'INSERT' AND NEW.type IN ('email', 'proposal', 'call', 'demo') THEN

    -- Check if activity has notes or description
    IF NEW.notes IS NOT NULL AND LENGTH(NEW.notes) > 50 THEN

      -- Call Edge Function asynchronously
      PERFORM call_suggest_next_actions_async(
        NEW.id,
        'activity',
        NEW.user_id
      );

    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_suggest_next_actions_activity ON activities;

-- Create trigger for activities
CREATE TRIGGER trigger_auto_suggest_next_actions_activity
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_suggest_next_actions_for_activity();

-- ============================================================================
-- PHASE 5: Manual Regeneration Function for Testing/Admin
-- ============================================================================

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

  -- Construct Edge Function URL
  edge_function_url := current_setting('app.settings.supabase_url', true) ||
                       '/functions/v1/suggest-next-actions';

  -- Make synchronous HTTP request for manual regeneration
  SELECT status, body INTO response_status, response_body
  FROM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'activityId', p_activity_id,
      'activityType', p_activity_type,
      'userId', v_user_id,
      'forceRegenerate', true
    )::text,
    timeout_milliseconds := 30000 -- 30 second timeout
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

-- ============================================================================
-- PHASE 6: Batch Processing Function for Backfilling
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_next_actions_for_meetings(
  p_limit INTEGER DEFAULT 10,
  p_min_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days'
)
RETURNS JSON AS $$
DECLARE
  meeting_record RECORD;
  processed_count INTEGER := 0;
  queued_count INTEGER := 0;
  skipped_count INTEGER := 0;
BEGIN
  -- Loop through recent meetings without suggestions
  FOR meeting_record IN
    SELECT id, owner_user_id, title, transcript_text, summary
    FROM meetings
    WHERE meeting_start >= p_min_date
      AND (next_actions_generated_at IS NULL OR next_actions_count = 0)
      AND (transcript_text IS NOT NULL OR summary IS NOT NULL)
    ORDER BY meeting_start DESC
    LIMIT p_limit
  LOOP
    processed_count := processed_count + 1;

    BEGIN
      -- Queue suggestion generation
      PERFORM call_suggest_next_actions_async(
        meeting_record.id,
        'meeting',
        meeting_record.owner_user_id
      );

      queued_count := queued_count + 1;

    EXCEPTION WHEN OTHERS THEN
      skipped_count := skipped_count + 1;
      RAISE WARNING 'Failed to queue suggestions for meeting %: %',
        meeting_record.id, SQLERRM;
    END;

  END LOOP;

  RETURN json_build_object(
    'processed', processed_count,
    'queued', queued_count,
    'skipped', skipped_count,
    'limit', p_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 7: Comments and Documentation
-- ============================================================================

COMMENT ON FUNCTION call_suggest_next_actions_async IS
  'Asynchronously calls the suggest-next-actions Edge Function via pg_net';

COMMENT ON FUNCTION trigger_suggest_next_actions_for_meeting IS
  'Trigger function to auto-generate suggestions for new meetings with transcript/summary';

COMMENT ON FUNCTION trigger_suggest_next_actions_for_activity IS
  'Trigger function to auto-generate suggestions for important activities (email, proposal, call, demo)';

COMMENT ON FUNCTION regenerate_next_actions_for_activity IS
  'Manually regenerate suggestions for a specific activity (synchronous, for testing/admin use)';

COMMENT ON FUNCTION backfill_next_actions_for_meetings IS
  'Batch process recent meetings to generate missing suggestions (for backfilling)';

-- ============================================================================
-- PHASE 8: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION regenerate_next_actions_for_activity TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_next_actions_for_meetings TO service_role;
GRANT EXECUTE ON FUNCTION call_suggest_next_actions_async TO service_role;

-- ============================================================================
-- PHASE 9: Configuration Settings
-- ============================================================================

-- Note: The following settings should be configured via Supabase dashboard:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- These can also be set at runtime using:
-- SELECT set_config('app.settings.supabase_url', 'https://your-project.supabase.co', false);
-- SELECT set_config('app.settings.service_role_key', 'your-key', false);
