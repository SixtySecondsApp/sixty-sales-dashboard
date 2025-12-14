-- ============================================================================
-- Calls: Action Items + Task Linking
-- ============================================================================
-- Purpose:
--  - Add call_action_items (Calls equivalent of meeting_action_items)
--  - Add tasks.call_id and tasks.call_action_item_id for linkage + UX
--  - Provide RLS policies consistent with org-wide Calls visibility
--
-- Notes:
--  - Calls are org-visible (team-wide) by design
--  - We keep action items separate (meeting_action_items vs call_action_items)
--    and unify at the Tasks layer via FK columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Add linkage columns to tasks
-- ---------------------------------------------------------------------------

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_action_item_id UUID;

-- Add the FK separately so it can be created after the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'call_action_items'
  ) THEN
    -- no-op: will be created below in this same migration
    NULL;
  END IF;
END $$;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_call_id
  ON tasks(call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_call_action_item_id
  ON tasks(call_action_item_id)
  WHERE call_action_item_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Create call_action_items table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS call_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  assignee_name TEXT,
  assignee_email TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  deadline_at TIMESTAMPTZ,

  -- AI metadata
  importance TEXT CHECK (importance IN ('high', 'medium', 'low')),
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_generated BOOLEAN NOT NULL DEFAULT true,

  -- Optional timestamp within recording (seconds)
  timestamp_seconds NUMERIC,
  playback_url TEXT,

  -- Task linking / sync tracking
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  synced_to_task BOOLEAN NOT NULL DEFAULT false,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'excluded')),
  sync_error TEXT,
  synced_at TIMESTAMPTZ,

  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates per call by title (best-effort)
  CONSTRAINT call_action_items_unique_call_title UNIQUE (call_id, title)
);

CREATE INDEX IF NOT EXISTS idx_call_action_items_org_id
  ON call_action_items(org_id);
CREATE INDEX IF NOT EXISTS idx_call_action_items_call_id
  ON call_action_items(call_id);
CREATE INDEX IF NOT EXISTS idx_call_action_items_synced
  ON call_action_items(call_id, synced_to_task)
  WHERE synced_to_task = false;
CREATE INDEX IF NOT EXISTS idx_call_action_items_importance
  ON call_action_items(importance)
  WHERE importance IS NOT NULL;

-- updated_at trigger (reuses existing helper)
DROP TRIGGER IF EXISTS update_call_action_items_updated_at ON call_action_items;
CREATE TRIGGER update_call_action_items_updated_at
  BEFORE UPDATE ON call_action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Now add the FK from tasks.call_action_item_id → call_action_items.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'tasks'
      AND constraint_name = 'tasks_call_action_item_id_fkey'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_call_action_item_id_fkey
      FOREIGN KEY (call_action_item_id) REFERENCES call_action_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Enable RLS + policies (org-wide visibility, similar to calls)
-- ---------------------------------------------------------------------------

ALTER TABLE call_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_select_call_action_items" ON call_action_items;
CREATE POLICY "org_select_call_action_items"
  ON call_action_items FOR SELECT
  USING (can_access_org_data(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_insert_call_action_items" ON call_action_items;
CREATE POLICY "org_insert_call_action_items"
  ON call_action_items FOR INSERT
  WITH CHECK (can_write_to_org(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_update_call_action_items" ON call_action_items;
CREATE POLICY "org_update_call_action_items"
  ON call_action_items FOR UPDATE
  USING (can_access_org_data(org_id) OR public.is_service_role())
  WITH CHECK (can_write_to_org(org_id) OR public.is_service_role());

DROP POLICY IF EXISTS "org_delete_call_action_items" ON call_action_items;
CREATE POLICY "org_delete_call_action_items"
  ON call_action_items FOR DELETE
  USING (can_write_to_org(org_id) OR public.is_service_role());

-- Helpful comments
COMMENT ON TABLE call_action_items IS 'AI-extracted action items from call transcripts (Calls equivalent of meeting_action_items)';
COMMENT ON COLUMN tasks.call_id IS 'Direct reference to a call (JustCall etc.) associated with this task';
COMMENT ON COLUMN tasks.call_action_item_id IS 'Reference to a call action item that created this task (if applicable)';

