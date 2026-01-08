-- Migration: AI Analysis - Simpler Async Approach
-- Description: Cleaner implementation where AI analysis happens after task creation
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- PHASE 1: Revert to Simpler Trigger (No AI in trigger)
-- ============================================================================

-- Simplified trigger that creates tasks quickly without AI delay
CREATE OR REPLACE FUNCTION auto_create_task_from_action_item_v2()
RETURNS TRIGGER AS $$
DECLARE
  assignee_user_id UUID;
  meeting_owner_id UUID;
  meeting_title_text TEXT;
  task_priority TEXT;
  new_task_id UUID;
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
    NEW.sync_status := 'excluded';
    NEW.synced_to_task := false;
    RETURN NEW;
  END IF;

  -- Determine assignee
  IF NEW.assignee_email IS NOT NULL THEN
    assignee_user_id := get_user_id_from_email(NEW.assignee_email);
  END IF;

  -- Fallback to meeting owner
  IF assignee_user_id IS NULL THEN
    assignee_user_id := meeting_owner_id;
  END IF;

  -- Validate assignee
  IF assignee_user_id IS NULL THEN
    NEW.sync_status := 'failed';
    NEW.sync_error := 'No valid assignee found';
    RETURN NEW;
  END IF;

  -- Map priority
  task_priority := COALESCE(LOWER(NEW.priority), 'medium');
  IF task_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    task_priority := 'medium';
  END IF;

  BEGIN
    -- Create task with default values (AI will enhance later)
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
      COALESCE(NEW.deadline_at, NOW() + INTERVAL '3 days'), -- Default 3 days, AI will refine
      task_priority,
      CASE WHEN NEW.completed THEN 'completed' ELSE 'pending' END,
      'follow_up', -- Default type, AI will categorize
      assignee_user_id,
      assignee_user_id,
      NEW.id,
      CONCAT(
        'Category: ', COALESCE(NEW.category, 'General'),
        E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
        E'\n', 'Note: AI analysis pending...',
        E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
      ),
      NEW.completed
    )
    RETURNING id INTO new_task_id;

    -- Update action item
    NEW.task_id := new_task_id;
    NEW.synced_to_task := true;
    NEW.sync_status := 'synced';
    NEW.synced_at := NOW();
    NEW.sync_error := NULL;

    -- Trigger async AI analysis notification
    -- This will be picked up by a background worker or Edge Function
    PERFORM pg_notify('ai_analysis_needed', json_build_object(
      'action_item_id', NEW.id,
      'task_id', new_task_id
    )::text);

  EXCEPTION WHEN OTHERS THEN
    NEW.sync_status := 'failed';
    NEW.sync_error := CONCAT('Error creating task: ', SQLERRM);
    NEW.synced_to_task := false;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use new version
DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;
CREATE TRIGGER trigger_auto_create_task_from_action_item
  BEFORE INSERT ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_task_from_action_item_v2();

-- ============================================================================
-- PHASE 2: Function to Apply AI Analysis to Existing Task
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_ai_analysis_to_task(
  p_action_item_id UUID,
  p_task_type TEXT,
  p_ideal_deadline DATE,
  p_confidence_score NUMERIC,
  p_reasoning TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_task_id UUID;
  v_current_notes TEXT;
  v_updated_notes TEXT;
BEGIN
  -- Get task ID
  SELECT task_id INTO v_task_id
  FROM meeting_action_items
  WHERE id = p_action_item_id;

  IF v_task_id IS NULL THEN
    RAISE WARNING 'No task found for action item %', p_action_item_id;
    RETURN false;
  END IF;

  -- Get current notes
  SELECT notes INTO v_current_notes
  FROM tasks
  WHERE id = v_task_id;

  -- Update notes with AI reasoning
  v_updated_notes := REPLACE(
    COALESCE(v_current_notes, ''),
    'Note: AI analysis pending...',
    CONCAT('AI Analysis (Confidence: ', ROUND(p_confidence_score * 100), '%): ', p_reasoning)
  );

  -- Update task with AI-determined values
  UPDATE tasks
  SET
    task_type = p_task_type,
    due_date = p_ideal_deadline::TIMESTAMPTZ,
    notes = v_updated_notes,
    updated_at = NOW()
  WHERE id = v_task_id;

  -- Update action item with AI analysis
  UPDATE meeting_action_items
  SET
    ai_task_type = p_task_type,
    ai_deadline = p_ideal_deadline,
    ai_confidence_score = p_confidence_score,
    ai_reasoning = p_reasoning,
    ai_analyzed_at = NOW()
  WHERE id = p_action_item_id;

  RETURN true;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error applying AI analysis: %', SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 3: Batch AI Analysis Function
-- ============================================================================

-- Function to get pending action items for AI analysis
CREATE OR REPLACE FUNCTION get_pending_ai_analysis()
RETURNS TABLE (
  action_item_id UUID,
  task_id UUID,
  title TEXT,
  category TEXT,
  priority TEXT,
  deadline_at TIMESTAMPTZ,
  meeting_title TEXT,
  meeting_summary TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mai.id as action_item_id,
    mai.task_id,
    mai.title,
    mai.category,
    mai.priority,
    mai.deadline_at,
    m.title as meeting_title,
    m.summary as meeting_summary
  FROM meeting_action_items mai
  JOIN meetings m ON m.id = mai.meeting_id
  WHERE mai.task_id IS NOT NULL
    AND mai.ai_analyzed_at IS NULL
    AND mai.sync_status = 'synced'
  ORDER BY mai.created_at DESC
  LIMIT 100; -- Process in batches
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 4: Add Comments
-- ============================================================================

COMMENT ON FUNCTION auto_create_task_from_action_item_v2 IS 'Fast task creation with async AI analysis notification';
COMMENT ON FUNCTION apply_ai_analysis_to_task IS 'Apply AI analysis results to existing task';
COMMENT ON FUNCTION get_pending_ai_analysis IS 'Get action items pending AI analysis (max 100)';

-- ============================================================================
-- PHASE 5: Grant Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION apply_ai_analysis_to_task TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_pending_ai_analysis TO service_role, authenticated;
