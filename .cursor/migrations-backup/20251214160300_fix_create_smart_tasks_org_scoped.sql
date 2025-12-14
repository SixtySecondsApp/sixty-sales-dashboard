-- ============================================================================
-- Smart Tasks: Fix org scoping + assignee mapping
-- ============================================================================
-- Purpose:
--  - Ensure create_smart_tasks() writes tasks with org_id and uses templates
--    from the same org (multi-tenant isolation).
--  - Keep the assigned_to fix (use activities.user_id for assignment).
-- ============================================================================

CREATE OR REPLACE FUNCTION create_smart_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if the activity has a deal_id
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create tasks based on active templates in the same organization
  INSERT INTO tasks (
    title,
    description,
    due_date,
    task_type,
    priority,
    assigned_to,
    deal_id,
    created_by,
    status,
    org_id
  )
  SELECT
    stt.task_title,
    COALESCE(stt.task_description, '') ||
      E'\n\nAuto-generated from ' || NEW.type || ' activity on ' || TO_CHAR(NEW.created_at, 'YYYY-MM-DD'),
    (NEW.created_at::DATE + stt.days_after_trigger),
    stt.task_type,
    stt.priority,
    NEW.user_id,
    NEW.deal_id,
    NEW.user_id,
    'pending',
    NEW.org_id
  FROM smart_task_templates stt
  WHERE stt.trigger_activity_type = NEW.type
    AND stt.is_active = true
    AND (
      -- If org_id exists on templates, scope to the activity org.
      -- (In this codebase, smart_task_templates is org-scoped.)
      stt.org_id = NEW.org_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_smart_tasks() IS
  'Org-scoped smart task creation trigger. Creates tasks from smart_task_templates matching activity type within same org; assigns to activities.user_id.';

