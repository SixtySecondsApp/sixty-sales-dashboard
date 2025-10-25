-- Migration: AI-Powered Action Item Analysis
-- Description: Integrate Claude Haiku 4.5 for task type categorization and deadline analysis
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- PHASE 1: Enable pg_net Extension for HTTP Requests
-- ============================================================================

-- Enable pg_net for making HTTP requests from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- PHASE 2: Add AI Analysis Tracking Columns
-- ============================================================================

-- Add columns to track AI analysis results
ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS ai_task_type TEXT,
  ADD COLUMN IF NOT EXISTS ai_deadline DATE,
  ADD COLUMN IF NOT EXISTS ai_confidence_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add index for AI-analyzed items
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_ai_analyzed
  ON meeting_action_items(ai_analyzed_at)
  WHERE ai_analyzed_at IS NOT NULL;

-- ============================================================================
-- PHASE 3: AI Analysis Function
-- ============================================================================

-- Function to call Edge Function for AI analysis
CREATE OR REPLACE FUNCTION analyze_action_item_with_ai(p_action_item_id UUID)
RETURNS JSON AS $$
DECLARE
  edge_function_url TEXT;
  response_body TEXT;
  response_status INTEGER;
  analysis_result JSON;
BEGIN
  -- Get the Edge Function URL from environment
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/analyze-action-item';

  -- Make HTTP request to Edge Function
  SELECT status, body INTO response_status, response_body
  FROM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'action_item_id', p_action_item_id
    )::text
  );

  -- Check response status
  IF response_status != 200 THEN
    RAISE WARNING 'AI analysis failed with status %: %', response_status, response_body;
    RETURN NULL;
  END IF;

  -- Parse response
  analysis_result := response_body::json;

  -- Update action item with AI analysis
  UPDATE meeting_action_items
  SET
    ai_task_type = (analysis_result->>'task_type')::TEXT,
    ai_deadline = (analysis_result->>'ideal_deadline')::DATE,
    ai_confidence_score = (analysis_result->>'confidence_score')::NUMERIC,
    ai_reasoning = analysis_result->>'reasoning',
    ai_analyzed_at = NOW()
  WHERE id = p_action_item_id;

  RETURN analysis_result;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in AI analysis: %', SQLERRM;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: Update Auto-Create Task Function with AI Integration
-- ============================================================================

-- Enhanced version of auto_create_task_from_action_item with AI analysis
CREATE OR REPLACE FUNCTION auto_create_task_from_action_item()
RETURNS TRIGGER AS $$
DECLARE
  assignee_user_id UUID;
  meeting_owner_id UUID;
  meeting_title_text TEXT;
  task_priority TEXT;
  task_type_determined TEXT;
  deadline_determined TIMESTAMPTZ;
  new_task_id UUID;
  ai_analysis JSON;
  task_notes TEXT;
BEGIN
  -- Only process if not already synced
  IF NEW.task_id IS NOT NULL OR NEW.synced_to_task = true THEN
    RETURN NEW;
  END IF;

  -- Get meeting details
  SELECT owner_user_id, title INTO meeting_owner_id, meeting_title_text
  FROM meetings
  WHERE id = NEW.meeting_id;

  -- Only process if assignee is internal (sales rep)
  IF NEW.assignee_email IS NOT NULL AND NOT is_internal_assignee(NEW.assignee_email) THEN
    -- External assignee - exclude from sync
    NEW.sync_status := 'excluded';
    NEW.synced_to_task := false;
    RETURN NEW;
  END IF;

  -- Determine assignee
  IF NEW.assignee_email IS NOT NULL THEN
    assignee_user_id := get_user_id_from_email(NEW.assignee_email);
  END IF;

  -- Fallback to meeting owner if no assignee found
  IF assignee_user_id IS NULL THEN
    assignee_user_id := meeting_owner_id;
  END IF;

  -- Final check - must have a valid assignee
  IF assignee_user_id IS NULL THEN
    NEW.sync_status := 'failed';
    NEW.sync_error := 'No valid assignee found (no assignee email and no meeting owner)';
    RETURN NEW;
  END IF;

  -- Map Fathom priority to task priority
  task_priority := COALESCE(LOWER(NEW.priority), 'medium');
  IF task_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    task_priority := 'medium';
  END IF;

  -- ========================================================================
  -- AI ANALYSIS: Determine task type and ideal deadline
  -- ========================================================================

  BEGIN
    -- Call AI analysis function (asynchronous, best effort)
    -- We use pg_background or similar for async execution
    -- For now, we'll use a simple approach with error handling

    -- Note: The AI analysis will be called via the Edge Function
    -- For the initial implementation, we'll use inline HTTP call with net.http_post

    DECLARE
      edge_function_url TEXT;
      response_body TEXT;
      response_status INTEGER;
    BEGIN
      -- Construct Edge Function URL
      edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/analyze-action-item';

      -- Make HTTP request
      SELECT status, body INTO response_status, response_body
      FROM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'action_item_id', NEW.id
        )::text,
        timeout_milliseconds := 5000
      );

      IF response_status = 200 THEN
        ai_analysis := response_body::json;

        -- Use AI-determined task type
        task_type_determined := COALESCE((ai_analysis->>'task_type')::TEXT, 'follow_up');

        -- Use AI-determined deadline
        deadline_determined := COALESCE(
          (ai_analysis->>'ideal_deadline')::TIMESTAMPTZ,
          NEW.deadline_at,
          NOW() + INTERVAL '3 days'
        );

        -- Store AI reasoning in notes
        task_notes := CONCAT(
          'Category: ', COALESCE(NEW.category, 'General'),
          E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
          E'\n', 'AI Analysis (Confidence: ', ROUND((ai_analysis->>'confidence_score')::NUMERIC * 100), '%): ',
          ai_analysis->>'reasoning',
          E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
        );

        -- Update action item with AI results
        NEW.ai_task_type := task_type_determined;
        NEW.ai_deadline := (ai_analysis->>'ideal_deadline')::DATE;
        NEW.ai_confidence_score := (ai_analysis->>'confidence_score')::NUMERIC;
        NEW.ai_reasoning := ai_analysis->>'reasoning';
        NEW.ai_analyzed_at := NOW();

      ELSE
        -- AI analysis failed, use fallback logic
        RAISE WARNING 'AI analysis failed with status %, using fallback', response_status;
        task_type_determined := 'follow_up';
        deadline_determined := COALESCE(NEW.deadline_at, NOW() + INTERVAL '3 days');

        task_notes := CONCAT(
          'Category: ', COALESCE(NEW.category, 'General'),
          E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
          E'\n', 'Note: AI analysis unavailable, using default categorization',
          E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Error calling AI - use fallback logic
      RAISE WARNING 'Error calling AI analysis: %, using fallback', SQLERRM;
      task_type_determined := 'follow_up';
      deadline_determined := COALESCE(NEW.deadline_at, NOW() + INTERVAL '3 days');

      task_notes := CONCAT(
        'Category: ', COALESCE(NEW.category, 'General'),
        E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
        E'\n', 'Note: AI analysis error, using default categorization',
        E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
      );
    END;

  END;

  -- ========================================================================
  -- CREATE TASK with AI-determined values
  -- ========================================================================

  BEGIN
    -- Create task
    INSERT INTO tasks (
      title,
      description,
      due_date,
      priority,
      status,
      task_type,
      assigned_to,
      created_by,
      meeting_action_item_id,
      notes,
      completed
    ) VALUES (
      NEW.title,
      CONCAT('Action item from meeting: ', COALESCE(meeting_title_text, 'Unknown Meeting')),
      deadline_determined,
      task_priority,
      CASE WHEN NEW.completed THEN 'completed' ELSE 'pending' END,
      task_type_determined,
      assignee_user_id,
      assignee_user_id,
      NEW.id,
      task_notes,
      NEW.completed
    )
    RETURNING id INTO new_task_id;

    -- Update action item with sync status
    NEW.task_id := new_task_id;
    NEW.synced_to_task := true;
    NEW.sync_status := 'synced';
    NEW.synced_at := NOW();
    NEW.sync_error := NULL;

  EXCEPTION WHEN OTHERS THEN
    -- Handle errors gracefully
    NEW.sync_status := 'failed';
    NEW.sync_error := CONCAT('Error creating task: ', SQLERRM);
    NEW.synced_to_task := false;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger with updated function
DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;
CREATE TRIGGER trigger_auto_create_task_from_action_item
  BEFORE INSERT ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_task_from_action_item();

-- ============================================================================
-- PHASE 5: Manual AI Re-analysis Function
-- ============================================================================

-- Function to manually re-analyze action items with AI
CREATE OR REPLACE FUNCTION reanalyze_action_items_with_ai(p_meeting_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  action_item_record RECORD;
  analyzed_count INTEGER := 0;
  failed_count INTEGER := 0;
  result JSON;
BEGIN
  -- Loop through action items
  FOR action_item_record IN
    SELECT id, title
    FROM meeting_action_items
    WHERE (p_meeting_id IS NULL OR meeting_id = p_meeting_id)
      AND task_id IS NOT NULL
      AND ai_analyzed_at IS NULL
    LIMIT 50 -- Process in batches
  LOOP
    BEGIN
      -- Analyze with AI
      PERFORM analyze_action_item_with_ai(action_item_record.id);
      analyzed_count := analyzed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE WARNING 'Failed to analyze action item %: %', action_item_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN json_build_object(
    'analyzed', analyzed_count,
    'failed', failed_count,
    'meeting_id', p_meeting_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 6: Add Comments
-- ============================================================================

COMMENT ON COLUMN meeting_action_items.ai_task_type IS 'AI-determined task type using Claude Haiku 4.5';
COMMENT ON COLUMN meeting_action_items.ai_deadline IS 'AI-determined ideal deadline';
COMMENT ON COLUMN meeting_action_items.ai_confidence_score IS 'AI confidence score (0-1) for categorization';
COMMENT ON COLUMN meeting_action_items.ai_reasoning IS 'AI reasoning for task type and deadline choice';
COMMENT ON COLUMN meeting_action_items.ai_analyzed_at IS 'Timestamp when AI analysis was performed';

COMMENT ON FUNCTION analyze_action_item_with_ai IS 'Call Edge Function to analyze action item with Claude Haiku 4.5';
COMMENT ON FUNCTION reanalyze_action_items_with_ai IS 'Manually re-analyze existing action items with AI (max 50 per call)';

-- ============================================================================
-- PHASE 7: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION analyze_action_item_with_ai TO service_role;
GRANT EXECUTE ON FUNCTION reanalyze_action_items_with_ai TO authenticated, service_role;
