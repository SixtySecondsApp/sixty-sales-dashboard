-- Quick Migration: Essential Tables for Form → Workflow Execution
-- Run this in Supabase SQL Editor to fix form execution capture

-- 1. Workflow Executions Table (Essential)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  workflow_name TEXT,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('form', 'manual', 'schedule', 'webhook', 'event')),
  trigger_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'paused')),
  node_executions JSONB DEFAULT '[]',
  final_output JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Node Executions Table (Essential)
CREATE TABLE IF NOT EXISTS node_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Workflow Forms Table (Already exists, but ensure it's there)
CREATE TABLE IF NOT EXISTS workflow_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id TEXT UNIQUE NOT NULL,
  workflow_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  is_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id 
  ON workflow_executions(workflow_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
  ON workflow_executions(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_node_executions_execution_id 
  ON node_executions(execution_id, started_at);

CREATE INDEX IF NOT EXISTS idx_workflow_forms_workflow_id 
  ON workflow_forms(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_forms_test 
  ON workflow_forms(is_test, form_id);

-- Grant permissions
GRANT ALL ON workflow_executions TO authenticated;
GRANT ALL ON node_executions TO authenticated;
GRANT ALL ON workflow_forms TO authenticated;

-- Row Level Security
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_forms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own workflow executions" 
  ON workflow_executions FOR ALL 
  USING (
    workflow_id IN (
      SELECT id FROM user_automation_rules 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own node executions" 
  ON node_executions FOR ALL 
  USING (
    execution_id IN (
      SELECT id FROM workflow_executions 
      WHERE workflow_id IN (
        SELECT id FROM user_automation_rules 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their own workflow forms" 
  ON workflow_forms FOR ALL 
  USING (created_by = auth.uid());