-- Enhanced Workflow Backend Schema Migration
-- This migration creates all the necessary tables for the complete workflow automation system

-- 1. Workflow Templates Table
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  popularity INTEGER DEFAULT 0,
  estimated_time TEXT,
  tags TEXT[],
  trigger_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_config JSONB DEFAULT '{}',
  canvas_data JSONB DEFAULT '{}',
  icon_name TEXT,
  color TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enhanced User Automation Rules (Workflows)
ALTER TABLE user_automation_rules 
ADD COLUMN IF NOT EXISTS canvas_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES workflow_templates(id),
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS average_execution_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- 3. Workflow Executions Table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  execution_status TEXT NOT NULL CHECK (execution_status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  trigger_type TEXT NOT NULL,
  trigger_data JSONB DEFAULT '{}',
  action_results JSONB DEFAULT '{}',
  error_message TEXT,
  execution_time INTEGER,
  memory_usage INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Workflow Test Results Table
CREATE TABLE IF NOT EXISTS workflow_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  scenario_name TEXT NOT NULL,
  scenario_description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  passed BOOLEAN NOT NULL,
  execution_time INTEGER,
  points_earned INTEGER DEFAULT 0,
  error_message TEXT,
  test_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. User Testing Achievements Table
CREATE TABLE IF NOT EXISTS user_testing_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  icon_name TEXT,
  unlocked BOOLEAN DEFAULT false,
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 1,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_name)
);

-- 6. User Testing Stats Table
CREATE TABLE IF NOT EXISTS user_testing_stats (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  next_level_xp INTEGER DEFAULT 100,
  total_points INTEGER DEFAULT 0,
  tests_run INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Workflow Performance Metrics Table (for analytics)
CREATE TABLE IF NOT EXISTS workflow_performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  metric_date DATE NOT NULL,
  metric_hour INTEGER CHECK (metric_hour >= 0 AND metric_hour < 24),
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  average_execution_time INTEGER DEFAULT 0,
  min_execution_time INTEGER,
  max_execution_time INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, metric_date, metric_hour)
);

-- 8. Workflow Schedules Table (for scheduled executions)
CREATE TABLE IF NOT EXISTS workflow_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'hourly', 'daily', 'weekly', 'monthly')),
  schedule_config JSONB DEFAULT '{}',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Workflow Dependencies Table (for complex workflow chains)
CREATE TABLE IF NOT EXISTS workflow_dependencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  child_workflow_id UUID NOT NULL REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  dependency_type TEXT CHECK (dependency_type IN ('sequential', 'conditional', 'parallel')),
  condition_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_workflow_id, child_workflow_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_test_results_workflow_id ON workflow_test_results(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_test_results_user_id ON workflow_test_results(user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_performance_workflow_id ON workflow_performance_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_performance_date ON workflow_performance_metrics(metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run ON workflow_schedules(next_run_at) WHERE is_active = true;

-- Insert default workflow templates
INSERT INTO workflow_templates (name, description, category, difficulty, popularity, estimated_time, tags, trigger_type, action_type, trigger_config, action_config, icon_name, color) VALUES
('Follow-up After Proposal', 'Automatically create follow-up tasks 3 days after sending a proposal', 'Sales', 'easy', 95, '2 min', ARRAY['proposal', 'follow-up', 'automation'], 'activity_created', 'create_task', '{"activity_type": "proposal"}', '{"delay_days": 3, "task_title": "Follow up on proposal"}', 'Mail', 'bg-blue-600'),
('Deal Stage Notifications', 'Send notifications when deals move between pipeline stages', 'Sales', 'easy', 88, '3 min', ARRAY['pipeline', 'notification', 'stage'], 'pipeline_stage_changed', 'send_notification', '{}', '{"notification_type": "email"}', 'Target', 'bg-purple-600'),
('Task Assignment Flow', 'Auto-assign tasks based on team member availability', 'Productivity', 'medium', 92, '5 min', ARRAY['tasks', 'team', 'assignment'], 'task_created', 'assign_task', '{}', '{"assignment_logic": "round_robin"}', 'CheckSquare', 'bg-green-600'),
('Customer Onboarding', 'Complete onboarding workflow for new customers', 'Customer Success', 'hard', 85, '10 min', ARRAY['onboarding', 'customer', 'sequence'], 'deal_created', 'create_sequence', '{"stage": "signed"}', '{"sequence_steps": 5}', 'Users', 'bg-indigo-600'),
('Revenue Milestone Alerts', 'Get alerts for high-value deals and revenue milestones', 'Sales', 'easy', 90, '2 min', ARRAY['revenue', 'alerts', 'deals'], 'deal_created', 'send_notification', '{"min_value": 10000}', '{"alert_type": "high_value"}', 'DollarSign', 'bg-green-600');

-- Create functions for workflow execution tracking
CREATE OR REPLACE FUNCTION update_workflow_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.execution_status = 'success' THEN
    UPDATE user_automation_rules 
    SET 
      execution_count = execution_count + 1,
      success_count = success_count + 1,
      last_executed_at = NEW.completed_at,
      average_execution_time = CASE 
        WHEN execution_count = 0 THEN NEW.execution_time
        ELSE ((average_execution_time * execution_count) + NEW.execution_time) / (execution_count + 1)
      END
    WHERE id = NEW.workflow_id;
  ELSIF NEW.execution_status = 'failed' THEN
    UPDATE user_automation_rules 
    SET 
      execution_count = execution_count + 1,
      failure_count = failure_count + 1,
      last_executed_at = NEW.completed_at
    WHERE id = NEW.workflow_id;
  END IF;
  
  -- Update performance metrics
  INSERT INTO workflow_performance_metrics (
    workflow_id,
    user_id,
    metric_date,
    metric_hour,
    execution_count,
    success_count,
    failure_count,
    average_execution_time,
    min_execution_time,
    max_execution_time
  ) VALUES (
    NEW.workflow_id,
    NEW.user_id,
    DATE(NEW.completed_at),
    EXTRACT(HOUR FROM NEW.completed_at),
    1,
    CASE WHEN NEW.execution_status = 'success' THEN 1 ELSE 0 END,
    CASE WHEN NEW.execution_status = 'failed' THEN 1 ELSE 0 END,
    NEW.execution_time,
    NEW.execution_time,
    NEW.execution_time
  )
  ON CONFLICT (workflow_id, metric_date, metric_hour) 
  DO UPDATE SET
    execution_count = workflow_performance_metrics.execution_count + 1,
    success_count = workflow_performance_metrics.success_count + CASE WHEN NEW.execution_status = 'success' THEN 1 ELSE 0 END,
    failure_count = workflow_performance_metrics.failure_count + CASE WHEN NEW.execution_status = 'failed' THEN 1 ELSE 0 END,
    average_execution_time = ((workflow_performance_metrics.average_execution_time * workflow_performance_metrics.execution_count) + NEW.execution_time) / (workflow_performance_metrics.execution_count + 1),
    min_execution_time = LEAST(workflow_performance_metrics.min_execution_time, NEW.execution_time),
    max_execution_time = GREATEST(workflow_performance_metrics.max_execution_time, NEW.execution_time);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating workflow metrics
CREATE TRIGGER update_workflow_metrics_trigger
AFTER UPDATE OF execution_status ON workflow_executions
FOR EACH ROW
WHEN (NEW.execution_status IN ('success', 'failed'))
EXECUTE FUNCTION update_workflow_metrics();

-- Create function for updating user testing stats
CREATE OR REPLACE FUNCTION update_user_testing_stats()
RETURNS TRIGGER AS $$
DECLARE
  current_stats RECORD;
BEGIN
  -- Get current stats
  SELECT * INTO current_stats FROM user_testing_stats WHERE user_id = NEW.user_id;
  
  IF current_stats IS NULL THEN
    -- Create initial stats
    INSERT INTO user_testing_stats (user_id, tests_run, total_points)
    VALUES (NEW.user_id, 1, COALESCE(NEW.points_earned, 0));
  ELSE
    -- Update stats
    UPDATE user_testing_stats
    SET 
      tests_run = tests_run + 1,
      total_points = total_points + COALESCE(NEW.points_earned, 0),
      xp = xp + COALESCE(NEW.points_earned, 0),
      current_streak = CASE 
        WHEN NEW.passed THEN current_streak + 1 
        ELSE 0 
      END,
      best_streak = GREATEST(best_streak, CASE 
        WHEN NEW.passed THEN current_streak + 1 
        ELSE current_streak 
      END),
      success_rate = (
        SELECT ROUND(
          (COUNT(*) FILTER (WHERE passed = true)::DECIMAL / COUNT(*)::DECIMAL) * 100, 
          2
        )
        FROM workflow_test_results 
        WHERE user_id = NEW.user_id
      ),
      level = CASE 
        WHEN xp + COALESCE(NEW.points_earned, 0) >= next_level_xp THEN level + 1
        ELSE level
      END,
      next_level_xp = CASE 
        WHEN xp + COALESCE(NEW.points_earned, 0) >= next_level_xp THEN next_level_xp * 2
        ELSE next_level_xp
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating testing stats
CREATE TRIGGER update_user_testing_stats_trigger
AFTER INSERT ON workflow_test_results
FOR EACH ROW
EXECUTE FUNCTION update_user_testing_stats();

-- Add Row Level Security policies
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_testing_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_testing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view public templates" ON workflow_templates
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can manage their own templates" ON workflow_templates
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users can view their own executions" ON workflow_executions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own test results" ON workflow_test_results
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own achievements" ON user_testing_achievements
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own stats" ON user_testing_stats
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own performance metrics" ON workflow_performance_metrics
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own schedules" ON workflow_schedules
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own dependencies" ON workflow_dependencies
  FOR ALL USING (
    parent_workflow_id IN (SELECT id FROM user_automation_rules WHERE user_id = auth.uid())
  );

-- Create monitoring function for workflow health
CREATE OR REPLACE FUNCTION get_workflow_health(p_user_id UUID)
RETURNS TABLE(
  workflow_id UUID,
  workflow_name TEXT,
  health_status TEXT,
  success_rate DECIMAL,
  avg_execution_time INTEGER,
  last_execution TIMESTAMPTZ,
  issues TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.rule_name,
    CASE 
      WHEN r.failure_count::DECIMAL / NULLIF(r.execution_count, 0) > 0.3 THEN 'critical'
      WHEN r.failure_count::DECIMAL / NULLIF(r.execution_count, 0) > 0.1 THEN 'warning'
      ELSE 'healthy'
    END as health_status,
    ROUND((r.success_count::DECIMAL / NULLIF(r.execution_count, 0)) * 100, 2) as success_rate,
    r.average_execution_time,
    r.last_executed_at,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN r.failure_count::DECIMAL / NULLIF(r.execution_count, 0) > 0.3 THEN 'High failure rate' END,
      CASE WHEN r.average_execution_time > 5000 THEN 'Slow execution' END,
      CASE WHEN r.last_executed_at < NOW() - INTERVAL '7 days' THEN 'Not recently executed' END
    ], NULL) as issues
  FROM user_automation_rules r
  WHERE r.user_id = p_user_id
    AND r.is_active = true;
END;
$$ LANGUAGE plpgsql;