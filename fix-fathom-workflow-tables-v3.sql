-- Fix Fathom Workflow Tables V3
-- This version finds your actual user ID and handles constraints properly

-- Step 1: Find your user ID (replace the email with your actual email)
-- IMPORTANT: Change this email to YOUR email address!
WITH user_lookup AS (
  SELECT id, email 
  FROM auth.users 
  WHERE email = 'andrew.bryce@sixtyseconds.video'  -- CHANGE THIS TO YOUR EMAIL
  LIMIT 1
)
SELECT 
  id as your_user_id,
  email as your_email,
  '>>> COPY THE USER ID ABOVE AND USE IT IN STEP 4 <<<' as instruction
FROM user_lookup;

-- If no user found, list all users so you can find yours:
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check and fix constraints
-- First, see what constraints exist
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_automation_rules'::regclass
AND contype = 'c';

-- Drop the existing check constraints
ALTER TABLE user_automation_rules 
DROP CONSTRAINT IF EXISTS user_automation_rules_trigger_type_check,
DROP CONSTRAINT IF EXISTS user_automation_rules_action_type_check;

-- Add new check constraints that include webhook support
ALTER TABLE user_automation_rules 
ADD CONSTRAINT user_automation_rules_trigger_type_check 
CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'webhook', 'manual'));

ALTER TABLE user_automation_rules 
ADD CONSTRAINT user_automation_rules_action_type_check 
CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'webhook_process', 'update_field'));

-- Step 3: Create required tables
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

-- Step 4: INSERT THE WORKFLOW
-- ⚠️ IMPORTANT: Replace 'YOUR_USER_ID_HERE' with the actual user ID from Step 1
-- ⚠️ You MUST run Step 1 first to find your user ID!

/*
-- UNCOMMENT THIS SECTION AND REPLACE THE USER_ID:

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
  'YOUR_USER_ID_HERE',  -- <<< REPLACE THIS WITH YOUR ACTUAL USER ID FROM STEP 1
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
ON CONFLICT (id) DO UPDATE
SET 
  rule_name = EXCLUDED.rule_name,
  rule_description = EXCLUDED.rule_description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW()
RETURNING id as workflow_id;

*/

-- Step 5: Verify everything is set up
SELECT 
  'user_automation_rules' as table_name,
  column_name,
  data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
  AND table_schema = 'public'
  AND column_name = 'user_id';

-- List any existing workflows
SELECT 
  id as workflow_id, 
  user_id,
  rule_name,
  trigger_type,
  action_type,
  is_active
FROM user_automation_rules 
WHERE rule_name LIKE '%Fathom%'
   OR trigger_type = 'webhook'
LIMIT 10;