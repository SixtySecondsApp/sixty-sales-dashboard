-- Simple Fix for Workflow Tables - Step by Step
-- Run each section separately to isolate any errors

-- ========================================
-- SECTION 1: Check Current State
-- ========================================
-- Run this first to see what columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- SECTION 2: Drop Everything and Start Fresh
-- ========================================
-- Drop all policies first (these might be causing the error)
DROP POLICY IF EXISTS "Users can view own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can create own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can update own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can delete own automation rules" ON public.user_automation_rules;
DROP POLICY IF EXISTS "Users can manage their own automation rules" ON public.user_automation_rules;

-- Now drop the table completely
DROP TABLE IF EXISTS public.user_automation_rules CASCADE;

-- ========================================
-- SECTION 3: Create Fresh Table
-- ========================================
-- Create a new table with simple structure first
CREATE TABLE public.user_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,  -- Don't add foreign key yet
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

-- ========================================
-- SECTION 4: Add Foreign Key Separately
-- ========================================
-- Add the foreign key constraint after table creation
ALTER TABLE public.user_automation_rules
ADD CONSTRAINT user_automation_rules_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ========================================
-- SECTION 5: Add Check Constraints
-- ========================================
ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_trigger_type_check 
CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'webhook', 'manual'));

ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_action_type_check 
CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'webhook_process', 'update_field'));

-- ========================================
-- SECTION 6: Create Indexes
-- ========================================
CREATE INDEX idx_user_automation_rules_user_id ON public.user_automation_rules(user_id);
CREATE INDEX idx_user_automation_rules_trigger_type ON public.user_automation_rules(trigger_type) WHERE is_active = true;

-- ========================================
-- SECTION 7: Enable RLS (But No Policies Yet)
-- ========================================
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- ========================================
-- SECTION 8: Create Other Tables
-- ========================================
-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL,  -- Don't add foreign key yet
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

-- Add foreign key for workflow_executions
ALTER TABLE workflow_executions
ADD CONSTRAINT workflow_executions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);

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

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);

-- Add Fathom fields to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS fathom_embed_url TEXT,
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB,
ADD COLUMN IF NOT EXISTS transcript_doc_url TEXT;

-- ========================================
-- SECTION 9: Get a Valid User ID
-- ========================================
-- Find the first valid user
SELECT 
  id as user_id,
  email,
  created_at,
  '>>> COPY THIS USER_ID FOR THE NEXT STEP <<<' as instruction
FROM auth.users 
WHERE id IS NOT NULL
ORDER BY created_at 
LIMIT 5;

-- ========================================
-- SECTION 10: Insert Test Workflow
-- ========================================
-- IMPORTANT: Replace 'PASTE_USER_ID_HERE' with an actual user ID from Section 9

/*
-- UNCOMMENT AND RUN THIS AFTER GETTING A USER ID:

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
  'PASTE_USER_ID_HERE',  -- <<< REPLACE WITH ACTUAL USER ID
  'Fathom Meeting Integration',
  'Process Fathom webhook payloads for meetings',
  'webhook',
  'webhook_process',
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
RETURNING 
  id as workflow_id,
  user_id,
  rule_name,
  '>>> USE THIS WORKFLOW ID FOR TESTING <<<' as instruction;

*/

-- ========================================
-- SECTION 11: Add RLS Policies (AFTER Everything Else)
-- ========================================
-- Only add these after confirming the table has user_id column

/*
-- UNCOMMENT AND RUN THESE AFTER CONFIRMING EVERYTHING WORKS:

CREATE POLICY "Users can view own automation rules" 
  ON public.user_automation_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automation rules" 
  ON public.user_automation_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automation rules" 
  ON public.user_automation_rules
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own automation rules" 
  ON public.user_automation_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- For workflow_executions
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

-- For meeting_action_items (uses owner_user_id from meetings table)
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

*/

-- ========================================
-- SECTION 12: Final Verification
-- ========================================
-- Check that everything is created correctly
SELECT 
  'user_automation_rules' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
AND column_name IN ('id', 'user_id', 'rule_name')
ORDER BY ordinal_position;

-- Show any workflows that were created
SELECT 
  id as workflow_id,
  user_id,
  rule_name,
  trigger_type,
  action_type,
  is_active
FROM public.user_automation_rules
WHERE rule_name LIKE '%Fathom%';