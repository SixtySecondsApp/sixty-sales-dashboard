-- Fix the create_smart_tasks function to use assigned_to instead of owner_id
-- This addresses the not-null constraint violation in the tasks table

CREATE OR REPLACE FUNCTION create_smart_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if the activity has a deal_id
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create tasks based on active templates
  INSERT INTO tasks (
    title,
    description,
    due_date,
    task_type,
    priority,
    assigned_to,
    deal_id,
    created_by,
    status
  )
  SELECT 
    stt.task_title,
    COALESCE(stt.task_description, '') || 
      E'\n\nAuto-generated from ' || NEW.type || ' activity on ' || TO_CHAR(NEW.created_at, 'YYYY-MM-DD'),
    NEW.created_at::DATE + stt.days_after_trigger,
    stt.task_type,
    stt.priority,
    NEW.user_id,
    NEW.deal_id,
    NEW.user_id,
    'pending'
  FROM smart_task_templates stt
  WHERE stt.trigger_activity_type = NEW.type
    AND stt.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the fix
COMMENT ON FUNCTION create_smart_tasks() IS 'Auto-creates tasks from smart task templates when activities are inserted. Fixed to use assigned_to field instead of owner_id to satisfy not-null constraint.';