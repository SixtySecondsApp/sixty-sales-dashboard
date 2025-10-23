-- Fix Fathom Workflow Tables
-- Run this directly in Supabase SQL Editor to fix the user_id column error

-- Step 1: Create user_automation_rules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  canvas_data JSONB,
  trigger_type TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  template_id TEXT,
  is_active BOOLEAN DEFAULT false,
  priority_level INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies
DROP POLICY IF EXISTS "Users can view own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can create own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can update own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON public.user_automation_rules;

CREATE POLICY "Users can view own automation rules" ON public.user_automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules" ON public.user_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules" ON public.user_automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules" ON public.user_automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 4: Create a test workflow for Fathom integration
-- Note: action_type must be one of the allowed values from the check constraint
INSERT INTO public.user_automation_rules (
  user_id,
  rule_name,
  rule_description,
  trigger_type,
  action_type,
  is_active,
  canvas_data
)
VALUES (
  '053aab56-8fc6-4fe1-9cbe-702092b7780b', -- Your user ID
  'Fathom Meeting Integration',
  'Process Fathom webhook payloads for meetings',
  'activity_created',  -- Using an allowed trigger_type
  'create_task',       -- Using an allowed action_type
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
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING
RETURNING id as workflow_id;

-- Step 5: Create the Fathom-specific tables
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

-- Step 6: Verify the tables exist and have correct structure
SELECT 
  'user_automation_rules' as table_name,
  column_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- This query will show you the workflow_id to use in your tests
SELECT id as workflow_id, rule_name 
FROM user_automation_rules 
WHERE rule_name = 'Fathom Meeting Integration';