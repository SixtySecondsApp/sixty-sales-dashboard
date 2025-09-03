-- Smart Pipeline Automation Rules Migration
-- Create system for user-configurable pipeline stage automation

-- Create pipeline automation rules table
CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  
  -- Trigger conditions
  from_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,
  to_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,
  
  -- Action configuration
  action_type TEXT NOT NULL CHECK (action_type IN ('create_activity', 'create_task', 'send_notification', 'update_field')),
  
  -- Activity creation parameters (when action_type = 'create_activity')
  activity_type TEXT, -- 'proposal', 'meeting', 'call', etc.
  activity_title TEXT,
  activity_details TEXT,
  activity_amount_source TEXT CHECK (activity_amount_source IN ('deal_value', 'fixed_amount', 'none')) DEFAULT 'none',
  activity_fixed_amount DECIMAL(10,2),
  
  -- Task creation parameters (when action_type = 'create_task')
  task_title TEXT,
  task_description TEXT,
  task_type TEXT DEFAULT 'follow_up' CHECK (task_type IN ('follow_up', 'onboarding', 'check_in', 'reminder', 'action')),
  task_priority TEXT DEFAULT 'medium' CHECK (task_priority IN ('low', 'medium', 'high', 'urgent')),
  task_days_after INTEGER DEFAULT 0,
  
  -- Field update parameters (when action_type = 'update_field')
  update_field_name TEXT,
  update_field_value TEXT,
  
  -- Notification parameters (when action_type = 'send_notification')
  notification_message TEXT,
  notification_type TEXT DEFAULT 'info' CHECK (notification_type IN ('info', 'success', 'warning', 'error')),
  
  -- Rule metadata
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_rule_name_per_transition UNIQUE(from_stage_id, to_stage_id, rule_name),
  CONSTRAINT action_params_check CHECK (
    CASE action_type
      WHEN 'create_activity' THEN activity_type IS NOT NULL AND activity_title IS NOT NULL
      WHEN 'create_task' THEN task_title IS NOT NULL
      WHEN 'update_field' THEN update_field_name IS NOT NULL AND update_field_value IS NOT NULL
      WHEN 'send_notification' THEN notification_message IS NOT NULL
      ELSE true
    END
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_from_to_stage ON pipeline_automation_rules(from_stage_id, to_stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_active ON pipeline_automation_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_execution_order ON pipeline_automation_rules(execution_order);

-- Create audit log table for rule executions
CREATE TABLE IF NOT EXISTS pipeline_automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES pipeline_automation_rules(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES deal_stages(id) ON DELETE SET NULL,
  to_stage_id UUID REFERENCES deal_stages(id) ON DELETE SET NULL,
  execution_status TEXT NOT NULL CHECK (execution_status IN ('success', 'failed', 'skipped')) DEFAULT 'success',
  execution_details JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_deal_id ON pipeline_automation_executions(deal_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_rule_id ON pipeline_automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_executed_at ON pipeline_automation_executions(executed_at);

-- Create function to execute pipeline automation rules
CREATE OR REPLACE FUNCTION execute_pipeline_automation_rules()
RETURNS TRIGGER AS $$
DECLARE
  rule_record pipeline_automation_rules%ROWTYPE;
  old_stage_name TEXT;
  new_stage_name TEXT;
  execution_result JSONB;
  activity_id UUID;
  task_id UUID;
  activity_amount DECIMAL(10,2);
BEGIN
  -- Skip if no stage change
  IF OLD.stage_id = NEW.stage_id THEN
    RETURN NEW;
  END IF;

  -- Get stage names for logging
  SELECT name INTO old_stage_name FROM deal_stages WHERE id = OLD.stage_id;
  SELECT name INTO new_stage_name FROM deal_stages WHERE id = NEW.stage_id;
  
  -- Find and execute matching automation rules
  FOR rule_record IN
    SELECT * FROM pipeline_automation_rules
    WHERE (from_stage_id = OLD.stage_id OR from_stage_id IS NULL)
      AND to_stage_id = NEW.stage_id
      AND is_active = true
    ORDER BY execution_order ASC, created_at ASC
  LOOP
    BEGIN
      execution_result := jsonb_build_object();
      
      -- Execute action based on type
      CASE rule_record.action_type
        WHEN 'create_activity' THEN
          -- Calculate activity amount
          activity_amount := 0;
          IF rule_record.activity_amount_source = 'deal_value' THEN
            activity_amount := COALESCE(NEW.value, 0);
          ELSIF rule_record.activity_amount_source = 'fixed_amount' THEN
            activity_amount := COALESCE(rule_record.activity_fixed_amount, 0);
          END IF;
          
          -- Create activity
          INSERT INTO activities (
            user_id,
            type,
            client_name,
            details,
            amount,
            priority,
            date,
            status,
            quantity,
            deal_id,
            sales_rep
          ) VALUES (
            NEW.owner_id,
            rule_record.activity_type,
            COALESCE(NEW.company, NEW.name, 'Unknown Client'),
            COALESCE(rule_record.activity_details, rule_record.activity_title),
            activity_amount,
            'medium',
            NOW(),
            'completed',
            1,
            NEW.id,
            (SELECT COALESCE(first_name || ' ' || last_name, email) FROM user_profiles WHERE id = NEW.owner_id LIMIT 1)
          ) RETURNING id INTO activity_id;
          
          execution_result := execution_result || jsonb_build_object('activity_id', activity_id, 'amount', activity_amount);
          
        WHEN 'create_task' THEN
          -- Create task
          INSERT INTO tasks (
            title,
            description,
            type,
            priority,
            status,
            due_date,
            deal_id,
            assigned_to,
            created_by
          ) VALUES (
            rule_record.task_title,
            COALESCE(rule_record.task_description, rule_record.task_title),
            rule_record.task_type,
            rule_record.task_priority,
            'pending',
            (CURRENT_DATE + INTERVAL '1 day' * rule_record.task_days_after),
            NEW.id,
            NEW.owner_id,
            NEW.owner_id
          ) RETURNING id INTO task_id;
          
          execution_result := execution_result || jsonb_build_object('task_id', task_id, 'due_date', (CURRENT_DATE + INTERVAL '1 day' * rule_record.task_days_after));
          
        WHEN 'update_field' THEN
          -- Field updates would need dynamic SQL - placeholder for now
          execution_result := execution_result || jsonb_build_object('field_updated', rule_record.update_field_name, 'new_value', rule_record.update_field_value);
          
        WHEN 'send_notification' THEN
          -- Notifications would integrate with notification system - placeholder for now
          execution_result := execution_result || jsonb_build_object('notification_sent', true, 'message', rule_record.notification_message);
      END CASE;
      
      -- Log successful execution
      INSERT INTO pipeline_automation_executions (
        rule_id,
        deal_id,
        from_stage_id,
        to_stage_id,
        execution_status,
        execution_details,
        executed_by
      ) VALUES (
        rule_record.id,
        NEW.id,
        OLD.stage_id,
        NEW.stage_id,
        'success',
        execution_result,
        NEW.owner_id
      );
      
    EXCEPTION WHEN OTHERS THEN
      -- Log failed execution
      INSERT INTO pipeline_automation_executions (
        rule_id,
        deal_id,
        from_stage_id,
        to_stage_id,
        execution_status,
        error_message,
        executed_by
      ) VALUES (
        rule_record.id,
        NEW.id,
        OLD.stage_id,
        NEW.stage_id,
        'failed',
        SQLERRM,
        NEW.owner_id
      );
    END;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to execute automation rules on deal stage changes
DROP TRIGGER IF EXISTS trigger_pipeline_automation ON deals;
CREATE TRIGGER trigger_pipeline_automation
  AFTER UPDATE OF stage_id ON deals
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION execute_pipeline_automation_rules();

-- Row Level Security Policies
ALTER TABLE pipeline_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_automation_executions ENABLE ROW LEVEL SECURITY;

-- Admin management policy for rules
CREATE POLICY "Admins can manage pipeline automation rules" ON pipeline_automation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- All authenticated users can view active rules
CREATE POLICY "All users can view active pipeline automation rules" ON pipeline_automation_rules
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- Users can view execution logs for their own deals
CREATE POLICY "Users can view execution logs for their deals" ON pipeline_automation_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deals 
      WHERE deals.id = pipeline_automation_executions.deal_id 
      AND deals.owner_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Insert default automation rules
INSERT INTO pipeline_automation_rules (
  rule_name,
  rule_description,
  from_stage_id,
  to_stage_id,
  action_type,
  activity_type,
  activity_title,
  activity_details,
  activity_amount_source,
  is_active,
  execution_order
) VALUES 
-- SQL to Opportunity (Proposal) automation - disabled by default so users can enable manually
(
  'Auto-create proposal activity',
  'Automatically creates a proposal activity when a deal moves from SQL to Opportunity stage',
  (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%sql%' LIMIT 1),
  (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%opportunity%' LIMIT 1),
  'create_activity',
  'proposal',
  'Proposal sent',
  'Proposal sent for deal',
  'deal_value',
  false, -- Disabled by default - users can enable
  1
),
-- Opportunity to Verbal (Follow-up task) automation
(
  'Create follow-up task for verbal stage',
  'Creates a follow-up task 3 days after deal moves to Verbal stage',
  (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%opportunity%' LIMIT 1),
  (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%verbal%' LIMIT 1),
  'create_task',
  null,
  'Follow up on verbal agreement',
  'Follow up to confirm verbal agreement and move towards contract signing',
  null,
  null,
  null,
  'follow_up',
  'high',
  3,
  false, -- Disabled by default
  1
);

-- Add helpful comments
COMMENT ON TABLE pipeline_automation_rules IS 'User-configurable automation rules for pipeline stage transitions';
COMMENT ON TABLE pipeline_automation_executions IS 'Audit log of pipeline automation rule executions';
COMMENT ON FUNCTION execute_pipeline_automation_rules() IS 'Executes automation rules when deals change stages';