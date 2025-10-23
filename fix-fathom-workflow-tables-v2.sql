-- Fix Fathom Workflow Tables V2
-- This version handles the existing check constraints properly

-- Step 1: First, let's see what constraints exist
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_automation_rules'::regclass
AND contype = 'c';

-- Step 2: Drop the existing check constraints if they exist
ALTER TABLE user_automation_rules 
DROP CONSTRAINT IF EXISTS user_automation_rules_trigger_type_check,
DROP CONSTRAINT IF EXISTS user_automation_rules_action_type_check;

-- Step 3: Add new check constraints that include webhook support
ALTER TABLE user_automation_rules 
ADD CONSTRAINT user_automation_rules_trigger_type_check 
CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'webhook', 'manual'));

ALTER TABLE user_automation_rules 
ADD CONSTRAINT user_automation_rules_action_type_check 
CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'webhook_process', 'update_field'));

-- Step 4: Now insert the Fathom workflow
INSERT INTO public.user_automation_rules (
  user_id,
  rule_name,
  rule_description,
  trigger_type,
  action_type,
  is_active,
  canvas_data,
  trigger_conditions,
  action_config
)
VALUES (
  '053aab56-8fc6-4fe1-9cbe-702092b7780b', -- Your user ID
  'Fathom Meeting Integration',
  'Process Fathom webhook payloads for meetings',
  'webhook',  -- Now this is allowed
  'webhook_process',  -- Now this is allowed
  true,
  '{
    "nodes": [
      {
        "id": "webhook-trigger",
        "type": "fathomWebhook",
        "position": {"x": 100, "y": 200},
        "data": {
          "label": "Fathom Webhook",
          "isConfigured": true
        }
      }
    ],
    "edges": []
  }'::jsonb,
  '{"webhook_type": "fathom"}'::jsonb,
  '{"process_type": "meeting_integration"}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET 
  rule_name = EXCLUDED.rule_name,
  rule_description = EXCLUDED.rule_description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
RETURNING id as workflow_id;

-- Step 5: Create the other required tables
-- Add Fathom fields to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS fathom_embed_url TEXT,
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB,
ADD COLUMN IF NOT EXISTS transcript_doc_url TEXT;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_meetings_fathom_recording_id 
ON meetings(fathom_recording_id) 
WHERE fathom_recording_id IS NOT NULL;

-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
ON workflow_executions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id 
ON workflow_executions(user_id);

-- Enable RLS for workflow_executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can create their own workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can update their own workflow executions" ON workflow_executions;

CREATE POLICY "Users can view their own workflow executions"
  ON workflow_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflow executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow executions"
  ON workflow_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create meeting_action_items table
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

-- Enable RLS for meeting_action_items
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can create action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can update action items for their meetings" ON meeting_action_items;
DROP POLICY IF EXISTS "Users can delete action items for their meetings" ON meeting_action_items;

-- IMPORTANT: meetings table uses owner_user_id NOT user_id
CREATE POLICY "Users can view action items for their meetings"
  ON meeting_action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create action items for their meetings"
  ON meeting_action_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update action items for their meetings"
  ON meeting_action_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete action items for their meetings"
  ON meeting_action_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = meeting_action_items.meeting_id 
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Step 6: Verify the tables and get the workflow ID
SELECT 
  'user_automation_rules' as table_name,
  column_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
  AND table_schema = 'public'
  AND column_name = 'user_id';

-- Get the workflow ID for testing
SELECT 
  id as workflow_id, 
  rule_name,
  trigger_type,
  action_type,
  is_active
FROM user_automation_rules 
WHERE rule_name = 'Fathom Meeting Integration'
LIMIT 1;