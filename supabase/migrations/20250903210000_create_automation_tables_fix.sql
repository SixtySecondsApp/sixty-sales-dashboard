-- Quick fix to create automation tables that are missing from the database
-- This creates the essential structure needed for the automation system to work

-- Create user_automation_rules table
CREATE TABLE IF NOT EXISTS user_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  
  -- Action configuration  
  action_type TEXT NOT NULL CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification')),
  action_config JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_rule_name UNIQUE(user_id, rule_name)
);

-- Create automation_executions table
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  trigger_data JSONB NOT NULL,
  execution_result JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped', 'test_mode')) DEFAULT 'success',
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Link to original entities for tracking
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_user_id ON user_automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_trigger_type ON user_automation_rules(trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_active ON user_automation_rules(is_active, user_id);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_executions_executed_at ON automation_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_deal_id ON automation_executions(deal_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_activity_id ON automation_executions(activity_id);

-- Row Level Security Policies
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own automation rules" ON user_automation_rules;
DROP POLICY IF EXISTS "Users can view their own automation executions" ON automation_executions;

-- Users can only manage their own automation rules
CREATE POLICY "Users can manage their own automation rules" ON user_automation_rules
  FOR ALL USING (user_id = auth.uid());

-- Users can view their own automation executions
CREATE POLICY "Users can view their own automation executions" ON automation_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_automation_rules 
      WHERE user_automation_rules.id = automation_executions.rule_id 
      AND user_automation_rules.user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE user_automation_rules IS 'Unified automation rules for users to configure activity-based, pipeline, and task automations';
COMMENT ON TABLE automation_executions IS 'Audit log of all automation rule executions with detailed results';