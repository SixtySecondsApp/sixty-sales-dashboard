-- Migration: Call Type Workflow Trigger
-- Purpose: Trigger workflows when meetings are classified with call types
-- Date: 2025-12-13

-- =============================================================================
-- Function: Trigger workflows on call type classification
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_call_type_workflows()
RETURNS TRIGGER AS $$
DECLARE
  call_type_name TEXT;
  call_type_data JSONB;
  old_call_type_id UUID;
  new_call_type_id UUID;
BEGIN
  -- Safely get call_type_id values (handle case where column might not exist in OLD)
  BEGIN
    old_call_type_id := (OLD).call_type_id;
  EXCEPTION WHEN OTHERS THEN
    old_call_type_id := NULL;
  END;
  
  BEGIN
    new_call_type_id := (NEW).call_type_id;
  EXCEPTION WHEN OTHERS THEN
    new_call_type_id := NULL;
  END;

  -- Only trigger if call_type_id was just set (was NULL, now has value)
  IF (old_call_type_id IS NULL OR old_call_type_id IS DISTINCT FROM new_call_type_id) AND new_call_type_id IS NOT NULL THEN
    -- Get call type name for workflow context
    SELECT name INTO call_type_name
    FROM org_call_types
    WHERE id = new_call_type_id;

    -- Build workflow trigger data
    call_type_data := jsonb_build_object(
      'meeting_id', NEW.id,
      'meeting_title', NEW.title,
      'call_type_id', new_call_type_id,
      'call_type_name', call_type_name,
      'call_type_confidence', NEW.call_type_confidence,
      'call_type_reasoning', NEW.call_type_reasoning,
      'meeting_start', NEW.meeting_start,
      'owner_user_id', NEW.owner_user_id,
      'company_id', NEW.company_id,
      'primary_contact_id', NEW.primary_contact_id
    );

    -- Notify workflow system via pg_notify
    -- This will be picked up by workflow execution engine
    PERFORM pg_notify('call_type_classified', call_type_data::text);

    -- Also insert into workflow_executions if user_automation_rules exist for this trigger
    -- This allows workflows to be triggered based on call_type_classified event
    INSERT INTO workflow_executions (
      id,
      workflow_id,
      workflow_name,
      triggered_by,
      trigger_data,
      started_at,
      status,
      created_by
    )
    SELECT
      gen_random_uuid()::text,
      r.id::text,
      r.rule_name,
      'call_type_classified',
      call_type_data,
      NOW(),
      'pending',
      NEW.owner_user_id
    FROM user_automation_rules r
    WHERE r.user_id = NEW.owner_user_id
      AND r.is_active = true
      AND r.trigger_type = 'call_type_classified'
      AND (
        -- If trigger_conditions specifies a call_type_id, match it
        (r.trigger_conditions->>'call_type_id')::uuid = new_call_type_id
        OR
        -- If trigger_conditions specifies a call_type_name, match it
        (r.trigger_conditions->>'call_type_name') = call_type_name
        OR
        -- If no specific conditions, trigger for all call types
        r.trigger_conditions IS NULL
        OR
        jsonb_typeof(r.trigger_conditions) = 'null'
      )
    ON CONFLICT DO NOTHING; -- Prevent duplicate executions

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on meetings table
-- Note: We check for call_type_id changes inside the function to handle cases where the column might not exist
DROP TRIGGER IF EXISTS trigger_call_type_workflows ON meetings;
CREATE TRIGGER trigger_call_type_workflows
  AFTER UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_call_type_workflows();

-- Add comment
COMMENT ON FUNCTION trigger_call_type_workflows IS 'Triggers workflows when a meeting is classified with a call type';

