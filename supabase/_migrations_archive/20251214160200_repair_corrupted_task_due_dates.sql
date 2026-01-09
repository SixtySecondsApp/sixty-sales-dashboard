-- ============================================================================
-- Repair corrupted task due dates (wrong year / ancient overdue)
-- ============================================================================
-- Purpose:
--  - Fix tasks created recently that have due_date far in the past (commonly caused
--    by AI inferring the wrong year, e.g. 2024 instead of 2025).
--  - Only target tasks that are clearly wrong and still incomplete.
--  - Preserve traceability in metadata.
-- ============================================================================

-- 1) Ensure metadata JSONB exists (some older schemas may not have it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE tasks ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2) Repair tasks:
--    - created in last 90 days
--    - due_date is >30 days in the past
--    - not completed/cancelled
--    - likely from meeting/call AI pipelines
WITH candidates AS (
  SELECT
    t.id,
    t.due_date,
    t.created_at,
    t.meeting_id,
    t.call_id,
    t.meeting_action_item_id,
    t.call_action_item_id,
    t.source,
    -- use meeting_start/call.started_at as an anchor when available
    m.meeting_start AS meeting_anchor,
    c.started_at AS call_anchor
  FROM tasks t
  LEFT JOIN meetings m ON m.id = t.meeting_id
  LEFT JOIN calls c ON c.id = t.call_id
  WHERE
    t.created_at >= NOW() - INTERVAL '90 days'
    AND t.due_date IS NOT NULL
    AND t.due_date < NOW() - INTERVAL '30 days'
    AND t.status NOT IN ('completed', 'cancelled')
    AND t.completed = FALSE
    AND (
      t.meeting_id IS NOT NULL OR
      t.call_id IS NOT NULL OR
      t.meeting_action_item_id IS NOT NULL OR
      t.call_action_item_id IS NOT NULL OR
      t.source IN ('ai_suggestion', 'fathom_action_item', 'justcall_action_item')
    )
),
repaired AS (
  SELECT
    id,
    due_date AS original_due_date,
    -- Try to preserve original offset relative to anchor; otherwise default to +3 days
    CASE
      WHEN meeting_anchor IS NOT NULL THEN
        NOW() + make_interval(days => GREATEST(1, LEAST(30, ROUND(EXTRACT(EPOCH FROM (due_date - meeting_anchor)) / 86400)::INT)))
      WHEN call_anchor IS NOT NULL THEN
        NOW() + make_interval(days => GREATEST(1, LEAST(30, ROUND(EXTRACT(EPOCH FROM (due_date - call_anchor)) / 86400)::INT)))
      ELSE
        NOW() + INTERVAL '3 days'
    END AS new_due_date
  FROM candidates
)
UPDATE tasks t
SET
  due_date = r.new_due_date,
  metadata = COALESCE(t.metadata, '{}'::jsonb) || jsonb_build_object(
    'due_date_repair',
    jsonb_build_object(
      'repaired_at', NOW(),
      'reason', 'due_date_was_far_in_past_for_recent_task',
      'original_due_date', r.original_due_date,
      'new_due_date', r.new_due_date
    )
  )
FROM repaired r
WHERE t.id = r.id;

