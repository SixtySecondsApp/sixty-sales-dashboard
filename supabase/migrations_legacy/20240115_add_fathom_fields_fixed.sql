-- FIXED VERSION: Properly handles all column names and references
-- IMPORTANT: meetings table uses owner_user_id NOT user_id
-- workflow_executions and other new tables reference auth.users(id) directly

-- Add Fathom-specific fields to meetings table (if not already present)
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS fathom_embed_url TEXT,
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB,
ADD COLUMN IF NOT EXISTS transcript_doc_url TEXT;

-- Add index for faster lookup by fathom_recording_id
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_recording_id 
ON meetings(fathom_recording_id) 
WHERE fathom_recording_id IS NOT NULL;

-- Create workflow_executions table if not exists
-- This table uses user_id correctly as it's a new table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- This is correct for this table
  trigger_type TEXT NOT NULL,
  trigger_data JSONB,
  execution_status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  action_results JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for workflow executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
ON workflow_executions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id 
ON workflow_executions(user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON workflow_executions(execution_status);

-- Create meeting_action_items table if not exists
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_name TEXT,
  assignee_email TEXT,
  priority TEXT,
  category TEXT,
  deadline_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  ai_generated BOOLEAN DEFAULT FALSE,
  timestamp_seconds INTEGER,
  playback_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for action items
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id 
ON meeting_action_items(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_assignee_email 
ON meeting_action_items(assignee_email);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_deadline 
ON meeting_action_items(deadline_at)
WHERE deadline_at IS NOT NULL;

-- Add RLS policies for workflow_executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can create their own workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can update their own workflow executions" ON workflow_executions;

-- Create RLS policies for workflow_executions (uses user_id column correctly)
CREATE POLICY "Users can view their own workflow executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);  -- workflow_executions table HAS a user_id column

CREATE POLICY "Users can create their own workflow executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);  -- workflow_executions table HAS a user_id column

CREATE POLICY "Users can update their own workflow executions"
  ON workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);  -- workflow_executions table HAS a user_id column

-- Add RLS policies for meeting_action_items
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can create action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can update action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can delete action items for their meetings" ON meeting_action_items;

-- Create RLS policies for meeting_action_items
-- CRITICAL: meetings table uses owner_user_id NOT user_id
CREATE POLICY "Users can view action items for their meetings"
  ON meeting_action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()  -- CORRECT: meetings uses owner_user_id
    )
  );

CREATE POLICY "Users can create action items for their meetings"
  ON meeting_action_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_id 
      AND meetings.owner_user_id = auth.uid()  -- CORRECT: meetings uses owner_user_id
    )
  );

CREATE POLICY "Users can update action items for their meetings"
  ON meeting_action_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()  -- CORRECT: meetings uses owner_user_id
    )
  );

CREATE POLICY "Users can delete action items for their meetings"
  ON meeting_action_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()  -- CORRECT: meetings uses owner_user_id
    )
  );

-- Add helpful comments explaining the column names
COMMENT ON COLUMN meetings.ai_training_metadata IS 'Stores Fathom AI metrics: sentiment_score, coach_rating, coach_summary, talk_time percentages, external_domains, has_external_invitees';

COMMENT ON COLUMN meetings.fathom_embed_url IS 'Fathom recording share URL for iframe embedding';

COMMENT ON COLUMN meetings.transcript_doc_url IS 'Google Docs URL containing the meeting transcript for AI training';

COMMENT ON COLUMN meetings.owner_user_id IS 'IMPORTANT: This is the correct column name for the meeting owner (NOT user_id). This references auth.users(id).';

COMMENT ON TABLE meeting_action_items IS 'Action items from meetings. Links to meetings table which uses owner_user_id (not user_id) for ownership.';

COMMENT ON TABLE workflow_executions IS 'Workflow execution history. This table correctly uses user_id column to reference auth.users(id).';