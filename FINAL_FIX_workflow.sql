-- FINAL FIX for Workflow Tables
-- This addresses the "column user_id referenced in foreign key constraint does not exist" error

-- ========================================
-- STEP 1: Clean Slate
-- ========================================
-- Drop everything to start fresh
DROP TABLE IF EXISTS public.user_automation_rules CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS meeting_action_items CASCADE;

-- ========================================
-- STEP 2: Create Table Structure FIRST (No Foreign Keys)
-- ========================================
CREATE TABLE public.user_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,  -- Just a UUID column, no constraint
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

-- Verify the column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
AND column_name = 'user_id';

-- ========================================
-- STEP 3: Add Constraints AFTER Table Creation
-- ========================================
-- Now add the foreign key (column definitely exists now)
ALTER TABLE public.user_automation_rules
ADD CONSTRAINT user_automation_rules_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add check constraints
ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_trigger_type_check 
CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'webhook', 'manual'));

ALTER TABLE public.user_automation_rules 
ADD CONSTRAINT user_automation_rules_action_type_check 
CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'webhook_process', 'update_field'));

-- Add indexes
CREATE INDEX idx_user_automation_rules_user_id ON public.user_automation_rules(user_id);
CREATE INDEX idx_user_automation_rules_trigger_type ON public.user_automation_rules(trigger_type) WHERE is_active = true;

-- Enable RLS (but don't add policies yet)
ALTER TABLE public.user_automation_rules ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 4: Create Other Required Tables
-- ========================================
-- workflow_executions table
CREATE TABLE workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  user_id UUID NOT NULL,
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

-- Add foreign key after creation
ALTER TABLE workflow_executions
ADD CONSTRAINT workflow_executions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Add indexes
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);

-- meeting_action_items table
CREATE TABLE meeting_action_items (
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

CREATE INDEX idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);

-- Add Fathom fields to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS fathom_embed_url TEXT,
ADD COLUMN IF NOT EXISTS ai_training_metadata JSONB,
ADD COLUMN IF NOT EXISTS transcript_doc_url TEXT;

-- ========================================
-- STEP 5: Get Valid User IDs
-- ========================================
SELECT 
  id as user_id,
  email,
  created_at,
  '>>> Use one of these user IDs below <<<' as instruction
FROM auth.users 
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- STEP 6: Create Test Workflow
-- ========================================
-- Replace YOUR_USER_ID with an actual ID from Step 5
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the first available user
  SELECT id INTO v_user_id
  FROM auth.users
  LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
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
      v_user_id,
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
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Workflow created for user: %', v_user_id;
  ELSE
    RAISE NOTICE 'No users found in auth.users table';
  END IF;
END $$;

-- ========================================
-- STEP 7: Verify and Get Workflow ID
-- ========================================
-- Show the created workflow
SELECT 
  id as workflow_id,
  user_id,
  rule_name,
  is_active,
  '>>> COPY THIS WORKFLOW ID FOR TESTING <<<' as instruction
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
LIMIT 1;

-- Verify table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules'
AND column_name IN ('id', 'user_id', 'rule_name', 'trigger_type')
ORDER BY ordinal_position;

-- ========================================
-- STEP 8: Add RLS Policies (Optional - Only if needed)
-- ========================================
-- Only run these if you need RLS policies
/*
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
*/