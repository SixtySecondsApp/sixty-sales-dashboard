-- Enhanced Workflow Automation System
-- Comprehensive schema for templates, advanced execution tracking, testing, and analytics

-- Add workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  
  -- Visual workflow data (React Flow format)
  canvas_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
  
  -- Execution configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed', 'manual')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'update_field')),
  action_config JSONB NOT NULL DEFAULT '{}',
  
  -- Template metadata
  is_public BOOLEAN DEFAULT true,
  difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  estimated_setup_time INTEGER DEFAULT 5, -- minutes
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_template_name UNIQUE(name)
);

-- Enhance user_automation_rules with canvas data and advanced features
ALTER TABLE user_automation_rules 
ADD COLUMN IF NOT EXISTS canvas_data JSONB DEFAULT '{"nodes": [], "edges": []}',
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES workflow_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_execution_time_ms INTEGER DEFAULT 0;

-- Workflow test results table
CREATE TABLE IF NOT EXISTS workflow_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workflow_templates(id) ON DELETE SET NULL,
  
  -- Test execution data
  test_scenario TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'performance', 'edge_case')) DEFAULT 'unit',
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')) DEFAULT 'failed',
  execution_time_ms INTEGER,
  error_message TEXT,
  test_data JSONB,
  expected_result JSONB,
  actual_result JSONB,
  
  -- Gamification
  points_awarded INTEGER DEFAULT 0,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
  
  -- Audit
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Workflow execution analytics table  
CREATE TABLE IF NOT EXISTS workflow_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Performance metrics
  execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  executions_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER DEFAULT 0,
  total_execution_time_ms BIGINT DEFAULT 0,
  
  -- Business impact metrics
  deals_created INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  activities_created INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  
  -- Efficiency metrics
  time_saved_minutes INTEGER DEFAULT 0,
  error_rate NUMERIC(5,4) DEFAULT 0,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_rule_date UNIQUE(rule_id, execution_date)
);

-- User testing achievements table
CREATE TABLE IF NOT EXISTS user_testing_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Achievement data
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  points_awarded INTEGER DEFAULT 0,
  
  -- Progress tracking
  current_progress INTEGER DEFAULT 0,
  required_progress INTEGER DEFAULT 1,
  is_completed BOOLEAN DEFAULT false,
  
  -- Metadata
  earned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_achievement UNIQUE(user_id, achievement_type)
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_public ON workflow_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_workflow_templates_tags ON workflow_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_usage ON workflow_templates(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_automation_rules_template ON user_automation_rules(template_id);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_priority ON user_automation_rules(priority_level DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_tags ON user_automation_rules USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_automation_rules_execution_count ON user_automation_rules(execution_count DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_test_results_rule ON workflow_test_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_status ON workflow_test_results(status);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_executed_at ON workflow_test_results(executed_at);

CREATE INDEX IF NOT EXISTS idx_workflow_analytics_user_date ON workflow_analytics(user_id, execution_date);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_rule ON workflow_analytics(rule_id);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_date ON workflow_analytics(execution_date);

CREATE INDEX IF NOT EXISTS idx_user_testing_achievements_user ON user_testing_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_testing_achievements_type ON user_testing_achievements(achievement_type);

-- Row Level Security Policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_testing_achievements ENABLE ROW LEVEL SECURITY;

-- Public templates are viewable by all authenticated users
CREATE POLICY "Public templates are viewable" ON workflow_templates
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

-- Users can create templates
CREATE POLICY "Users can create templates" ON workflow_templates
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON workflow_templates
  FOR UPDATE USING (created_by = auth.uid());

-- Users can view their own test results
CREATE POLICY "Users can manage their test results" ON workflow_test_results
  FOR ALL USING (
    executed_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_automation_rules 
      WHERE user_automation_rules.id = workflow_test_results.rule_id 
      AND user_automation_rules.user_id = auth.uid()
    )
  );

-- Users can view their own analytics
CREATE POLICY "Users can view their analytics" ON workflow_analytics
  FOR SELECT USING (user_id = auth.uid());

-- Users can manage their achievements
CREATE POLICY "Users can manage their achievements" ON user_testing_achievements
  FOR ALL USING (user_id = auth.uid());

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, category, canvas_data, trigger_type, trigger_conditions, action_type, action_config, difficulty_level, estimated_setup_time, tags, is_public, created_by) VALUES
(
  'Auto-Create Follow-up Task',
  'Automatically create a follow-up task when a deal moves to Opportunity stage',
  'sales',
  '{"nodes": [{"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Stage Changed", "type": "stage_changed", "iconName": "Target"}}, {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "If Stage = Opportunity", "condition": "stage equals Opportunity"}}, {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Create Follow-up Task", "type": "create_task", "iconName": "CheckSquare"}}], "edges": [{"id": "e1", "source": "trigger_1", "target": "condition_1"}, {"id": "e2", "source": "condition_1", "target": "action_1"}]}',
  'stage_changed',
  '{"stage": "Opportunity"}',
  'create_task',
  '{"task_title": "Follow up on proposal", "task_description": "Check in with prospect about proposal", "due_in_days": 3, "priority": "high"}',
  'easy',
  3,
  ARRAY['sales', 'follow-up', 'proposals'],
  true,
  null
),
(
  'High-Value Deal Alert',
  'Send notification when a high-value deal is created',
  'sales',
  '{"nodes": [{"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Deal Created", "type": "deal_created", "iconName": "Database"}}, {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "If Value > $10,000", "condition": "value greater than 10000"}}, {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Send Alert", "type": "send_notification", "iconName": "Bell"}}], "edges": [{"id": "e1", "source": "trigger_1", "target": "condition_1"}, {"id": "e2", "source": "condition_1", "target": "action_1"}]}',
  'deal_created',
  '{"value_threshold": 10000}',
  'send_notification',
  '{"message": "High-value deal created: {{deal_name}} - {{deal_value}}", "urgency": "high", "notify_admins": true}',
  'easy',
  2,
  ARRAY['sales', 'notifications', 'high-value'],
  true,
  null
),
(
  'Task Completion Workflow',
  'Create next steps when important tasks are completed',
  'productivity',
  '{"nodes": [{"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Task Completed", "type": "task_completed", "iconName": "CheckSquare"}}, {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "If Priority = High", "condition": "priority equals high"}}, {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Create Next Task", "type": "create_task", "iconName": "CheckSquare"}}], "edges": [{"id": "e1", "source": "trigger_1", "target": "condition_1"}, {"id": "e2", "source": "condition_1", "target": "action_1"}]}',
  'task_completed',
  '{"priority": "high"}',
  'create_task',
  '{"task_title": "Review completed: {{original_task_title}}", "task_description": "Review the results of the completed task", "due_in_days": 1}',
  'medium',
  5,
  ARRAY['productivity', 'task-management', 'automation'],
  true,
  null
),
(
  'Activity-Based Deal Update',
  'Update deal fields based on specific activities',
  'sales',
  '{"nodes": [{"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Activity Created", "type": "activity_created", "iconName": "Activity"}}, {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "If Type = Meeting", "condition": "activity_type equals meeting"}}, {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Update Deal", "type": "update_field", "iconName": "Database"}}], "edges": [{"id": "e1", "source": "trigger_1", "target": "condition_1"}, {"id": "e2", "source": "condition_1", "target": "action_1"}]}',
  'activity_created',
  '{"activity_type": "meeting"}',
  'update_field',
  '{"field": "last_meeting_date", "value": "{{activity_date}}", "update_stage": false}',
  'medium',
  4,
  ARRAY['sales', 'activities', 'data-entry'],
  true,
  null
),
(
  'Comprehensive Lead Qualification',
  'Multi-step workflow for qualifying new leads with scoring and routing',
  'sales',
  '{"nodes": [{"id": "trigger_1", "type": "trigger", "position": {"x": 100, "y": 100}, "data": {"label": "Deal Created", "type": "deal_created", "iconName": "Database"}}, {"id": "condition_1", "type": "condition", "position": {"x": 300, "y": 100}, "data": {"label": "If Source = Website", "condition": "source equals website"}}, {"id": "action_1", "type": "action", "position": {"x": 500, "y": 100}, "data": {"label": "Qualification Task", "type": "create_task", "iconName": "CheckSquare"}}, {"id": "action_2", "type": "action", "position": {"x": 500, "y": 200}, "data": {"label": "Send Welcome Email", "type": "send_notification", "iconName": "Mail"}}], "edges": [{"id": "e1", "source": "trigger_1", "target": "condition_1"}, {"id": "e2", "source": "condition_1", "target": "action_1"}, {"id": "e3", "source": "condition_1", "target": "action_2"}]}',
  'deal_created',
  '{"source": "website", "require_qualification": true}',
  'create_task',
  '{"task_title": "Qualify lead: {{deal_name}}", "task_description": "Research and qualify this website lead", "due_in_days": 1, "priority": "medium", "assign_to": "auto"}',
  'hard',
  10,
  ARRAY['sales', 'lead-qualification', 'automation', 'complex'],
  true,
  null
);

-- Comments
COMMENT ON TABLE workflow_templates IS 'Pre-built workflow templates that users can start from';
COMMENT ON TABLE workflow_test_results IS 'Results from workflow testing scenarios with gamification';
COMMENT ON TABLE workflow_analytics IS 'Daily aggregated analytics and performance metrics for workflows';
COMMENT ON TABLE user_testing_achievements IS 'Gamified achievements for workflow testing and creation';