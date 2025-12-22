-- ============================================================================
-- Smart Tasks: Fix broken trigger + tune global defaults
-- ============================================================================
-- Current production schema (this project) uses clerk_org_id (TEXT) on tasks/activities/templates,
-- not org_id (UUID). A previous migration accidentally replaced create_smart_tasks() with an
-- org_id-based version, which breaks the trigger at runtime.
--
-- This migration:
--  1) Fixes create_smart_tasks() to match actual columns (clerk_org_id)
--  2) Tunes the default template set to be simpler + compatible with tasks.task_type constraint
--     (task_type must be one of: call,email,meeting,follow_up,proposal,demo,general)
-- ============================================================================

-- 1) Fix create_smart_tasks() trigger function (clerk_org_id-based, backwards compatible)
CREATE OR REPLACE FUNCTION create_smart_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if the activity has a deal_id
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

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
    clerk_org_id
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
    NEW.clerk_org_id
  FROM smart_task_templates stt
  WHERE stt.trigger_activity_type = NEW.type
    AND stt.is_active = true
    -- Allow global templates (NULL/empty clerk_org_id) + org-specific overrides
    AND (
      COALESCE(stt.clerk_org_id, '') = ''
      OR (NEW.clerk_org_id IS NOT NULL AND stt.clerk_org_id = NEW.clerk_org_id)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_smart_tasks() IS
  'Creates follow-up tasks from smart_task_templates after activities insert. Uses clerk_org_id when available; allows global templates (NULL/empty clerk_org_id) and org-specific overrides.';

-- 2) Tune defaults (keep them simple + safe)
-- Outbound follow-up: 5 days is too slow for most reps; tighten to 2 days.
UPDATE smart_task_templates
SET days_after_trigger = 2, updated_at = NOW()
WHERE trigger_activity_type = 'outbound'
  AND task_title = 'Follow up on outreach';

-- Signed onboarding task_type must be compatible with tasks.task_type constraint.
UPDATE smart_task_templates
SET
  task_type = 'general',
  task_title = 'Kick off onboarding',
  task_description = 'Confirm next steps, owners, timeline, and schedule the kickoff call.',
  updated_at = NOW()
WHERE trigger_activity_type = 'signed'
  AND task_title = 'Begin onboarding';










