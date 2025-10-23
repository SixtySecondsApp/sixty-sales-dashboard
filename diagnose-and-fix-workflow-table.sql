-- Diagnostic and Fix Script for Workflow Tables
-- This script will diagnose the exact issue and fix it

-- ========================================
-- PART 1: DIAGNOSIS
-- ========================================

-- Check if user_automation_rules table exists and its structure
SELECT 
    'Table exists' as status,
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'user_automation_rules'
AND table_schema = 'public';

-- Show ALL columns in the user_automation_rules table
SELECT 
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check constraints on the table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.user_automation_rules'::regclass;

-- ========================================
-- PART 2: FIX - DROP AND RECREATE TABLE
-- ========================================

-- Drop the old table if it exists (with wrong structure)
DROP TABLE IF EXISTS public.user_automation_rules CASCADE;

-- Create the table with the correct structure
CREATE TABLE public.user_automation_rules (
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

-- Add constraints that allow webhook types
ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_trigger_type_check 
CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'webhook', 'manual'));

ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_action_type_check 
CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'webhook_process', 'update_field'));

-- Enable RLS
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Create indexes
CREATE INDEX idx_user_automation_rules_user_id ON public.user_automation_rules(user_id);
CREATE INDEX idx_user_automation_rules_trigger_type ON public.user_automation_rules(trigger_type) WHERE is_active = true;

-- ========================================
-- PART 3: CREATE OTHER REQUIRED TABLES
-- ========================================

-- Add Fathom fields to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS fathom_embed_url TEXT,
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB,
ADD COLUMN IF NOT EXISTS transcript_doc_url TEXT;

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

-- Create indexes for workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
ON workflow_executions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id 
ON workflow_executions(user_id);

-- Enable RLS for workflow_executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

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

-- Create indexes for meeting_action_items
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id 
ON meeting_action_items(meeting_id);

-- Enable RLS for meeting_action_items
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

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

-- ========================================
-- PART 4: INSERT TEST WORKFLOW
-- ========================================

-- Find the first user in the system to use for testing
WITH first_user AS (
  SELECT id, email 
  FROM auth.users 
  WHERE email LIKE '%@%'
  ORDER BY created_at 
  LIMIT 1
)
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
SELECT
  id as user_id,
  'Fathom Meeting Integration' as rule_name,
  'Process Fathom webhook payloads for meetings' as rule_description,
  'webhook' as trigger_type,
  'webhook_process' as action_type,
  true as is_active,
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
  }'::jsonb as canvas_data,
  '{"webhook_type": "fathom"}'::jsonb as trigger_conditions,
  '{"process_type": "meeting_integration"}'::jsonb as action_config
FROM first_user
ON CONFLICT (id) DO NOTHING
RETURNING 
  id as workflow_id,
  user_id,
  rule_name,
  '>>> USE THIS WORKFLOW ID FOR TESTING <<<' as instruction;

-- ========================================
-- PART 5: VERIFICATION
-- ========================================

-- Verify the table structure is correct
SELECT 
  'VERIFICATION: user_automation_rules columns' as check_type,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
  AND table_schema = 'public'
  AND column_name IN ('id', 'user_id', 'rule_name', 'trigger_type', 'action_type')
ORDER BY ordinal_position;

-- Show all workflows
SELECT 
  id as workflow_id,
  user_id,
  rule_name,
  trigger_type,
  action_type,
  is_active,
  created_at
FROM public.user_automation_rules
ORDER BY created_at DESC
LIMIT 5;