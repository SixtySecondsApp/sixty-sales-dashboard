-- Unified Smart Automations System Migration
-- Combines activity-based, pipeline, and task automations into a single system

-- Create unified automation rules table
CREATE TABLE IF NOT EXISTS user_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('activity_created', 'stage_changed', 'deal_created', 'task_completed')),
  trigger_conditions JSONB NOT NULL DEFAULT '{}', -- {activity_type: 'proposal', from_stage_id: 'uuid', to_stage_id: 'uuid', etc.}
  
  -- Action configuration  
  action_type TEXT NOT NULL CHECK (action_type IN ('create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification')),
  action_config JSONB NOT NULL DEFAULT '{}', -- All action parameters stored as JSON for flexibility
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_rule_name UNIQUE(user_id, rule_name)
);

-- Test execution tracking for user confidence
CREATE TABLE IF NOT EXISTS automation_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  test_scenario JSONB NOT NULL, -- Mock trigger data for testing
  expected_outcome JSONB NOT NULL,
  actual_outcome JSONB,
  test_status TEXT NOT NULL CHECK (test_status IN ('passed', 'failed', 'skipped', 'pending')) DEFAULT 'pending',
  test_notes TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Real execution audit log (enhanced from existing pipeline_automation_executions)
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
  trigger_data JSONB NOT NULL, -- Original trigger event data
  execution_result JSONB, -- Results of the automation execution
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

CREATE INDEX IF NOT EXISTS idx_automation_tests_rule_id ON automation_tests(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_tests_status ON automation_tests(test_status);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule_id ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_executions_executed_at ON automation_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_deal_id ON automation_executions(deal_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_activity_id ON automation_executions(activity_id);

-- Row Level Security Policies
ALTER TABLE user_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own automation rules
CREATE POLICY "Users can manage their own automation rules" ON user_automation_rules
  FOR ALL USING (user_id = auth.uid());

-- Users can only manage their own automation tests
CREATE POLICY "Users can manage their own automation tests" ON automation_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_automation_rules 
      WHERE user_automation_rules.id = automation_tests.rule_id 
      AND user_automation_rules.user_id = auth.uid()
    )
  );

-- Users can view their own automation executions
CREATE POLICY "Users can view their own automation executions" ON automation_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_automation_rules 
      WHERE user_automation_rules.id = automation_executions.rule_id 
      AND user_automation_rules.user_id = auth.uid()
    )
  );

-- Admins can view all automation executions for support purposes
CREATE POLICY "Admins can view all automation executions" ON automation_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Create function to execute unified automation rules
CREATE OR REPLACE FUNCTION execute_unified_automation_rules()
RETURNS TRIGGER AS $$
DECLARE
  rule_record user_automation_rules%ROWTYPE;
  execution_result JSONB;
  activity_id UUID;
  task_id UUID;
  deal_id UUID;
  trigger_data JSONB;
  start_time TIMESTAMP;
  execution_time_ms INTEGER;
BEGIN
  start_time := clock_timestamp();
  
  -- Determine trigger type and build trigger data based on the table being modified
  IF TG_TABLE_NAME = 'activities' THEN
    trigger_data := jsonb_build_object(
      'trigger_type', 'activity_created',
      'activity_id', NEW.id,
      'activity_type', NEW.type,
      'client_name', NEW.client_name,
      'amount', NEW.amount,
      'deal_id', NEW.deal_id,
      'user_id', NEW.user_id,
      'contact_identifier', NEW.contact_identifier
    );
    
    -- Find matching automation rules for activity creation
    FOR rule_record IN
      SELECT * FROM user_automation_rules
      WHERE user_id = NEW.user_id
        AND trigger_type = 'activity_created'
        AND is_active = true
        AND (
          trigger_conditions IS NULL 
          OR trigger_conditions = '{}'::jsonb
          OR (trigger_conditions->>'activity_type' IS NULL OR trigger_conditions->>'activity_type' = NEW.type)
        )
      ORDER BY execution_order ASC, created_at ASC
    LOOP
      BEGIN
        execution_result := execute_automation_action(rule_record, trigger_data, NEW.user_id);
        
        -- Log successful execution
        INSERT INTO automation_executions (
          rule_id, trigger_data, execution_result, status, execution_time_ms, executed_by, activity_id
        ) VALUES (
          rule_record.id,
          trigger_data,
          execution_result,
          'success',
          EXTRACT(epoch FROM (clock_timestamp() - start_time)) * 1000,
          NEW.user_id,
          NEW.id
        );
        
      EXCEPTION WHEN OTHERS THEN
        -- Log failed execution
        INSERT INTO automation_executions (
          rule_id, trigger_data, status, error_message, execution_time_ms, executed_by, activity_id
        ) VALUES (
          rule_record.id,
          trigger_data,
          'failed',
          SQLERRM,
          EXTRACT(epoch FROM (clock_timestamp() - start_time)) * 1000,
          NEW.user_id,
          NEW.id
        );
      END;
    END LOOP;
    
  ELSIF TG_TABLE_NAME = 'deals' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    trigger_data := jsonb_build_object(
      'trigger_type', 'stage_changed',
      'deal_id', NEW.id,
      'from_stage_id', OLD.stage_id,
      'to_stage_id', NEW.stage_id,
      'deal_name', NEW.name,
      'deal_value', NEW.value,
      'user_id', NEW.owner_id
    );
    
    -- Find matching automation rules for stage changes
    FOR rule_record IN
      SELECT * FROM user_automation_rules
      WHERE user_id = NEW.owner_id
        AND trigger_type = 'stage_changed'
        AND is_active = true
        AND (
          trigger_conditions IS NULL 
          OR trigger_conditions = '{}'::jsonb
          OR (
            (trigger_conditions->>'from_stage_id' IS NULL OR trigger_conditions->>'from_stage_id' = OLD.stage_id::text)
            AND (trigger_conditions->>'to_stage_id' IS NULL OR trigger_conditions->>'to_stage_id' = NEW.stage_id::text)
          )
        )
      ORDER BY execution_order ASC, created_at ASC
    LOOP
      BEGIN
        execution_result := execute_automation_action(rule_record, trigger_data, NEW.owner_id);
        
        -- Log successful execution
        INSERT INTO automation_executions (
          rule_id, trigger_data, execution_result, status, execution_time_ms, executed_by, deal_id
        ) VALUES (
          rule_record.id,
          trigger_data,
          execution_result,
          'success',
          EXTRACT(epoch FROM (clock_timestamp() - start_time)) * 1000,
          NEW.owner_id,
          NEW.id
        );
        
      EXCEPTION WHEN OTHERS THEN
        -- Log failed execution
        INSERT INTO automation_executions (
          rule_id, trigger_data, status, error_message, execution_time_ms, executed_by, deal_id
        ) VALUES (
          rule_record.id,
          trigger_data,
          'failed',
          SQLERRM,
          EXTRACT(epoch FROM (clock_timestamp() - start_time)) * 1000,
          NEW.owner_id,
          NEW.id
        );
      END;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to execute individual automation actions
CREATE OR REPLACE FUNCTION execute_automation_action(
  rule user_automation_rules,
  trigger_data JSONB,
  user_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  new_deal_id UUID;
  new_task_id UUID;
  new_activity_id UUID;
  stage_id UUID;
  deal_name TEXT;
  deal_value DECIMAL;
  existing_deal_id UUID;
BEGIN
  CASE rule.action_type
    WHEN 'create_deal' THEN
      -- Create a new deal based on activity information
      IF trigger_data->>'trigger_type' = 'activity_created' THEN
        -- Determine deal stage based on activity type and rule config
        SELECT id INTO stage_id 
        FROM deal_stages 
        WHERE id = (rule.action_config->>'target_stage_id')::uuid
           OR (rule.action_config->>'target_stage_id' IS NULL AND name = 'SQL')
        LIMIT 1;
        
        -- Generate deal name and value
        deal_name := COALESCE(trigger_data->>'client_name', 'New Deal') || ' - ' || COALESCE(trigger_data->>'activity_type', 'Activity');
        deal_value := COALESCE((trigger_data->>'amount')::decimal, 0);
        
        -- Create the deal
        INSERT INTO deals (
          name, company, value, stage_id, owner_id, probability, status, expected_close_date, 
          contact_email, contact_name, created_at
        ) VALUES (
          deal_name,
          trigger_data->>'client_name',
          deal_value,
          stage_id,
          user_id,
          COALESCE((rule.action_config->>'probability')::integer, 20),
          'active',
          (CURRENT_DATE + INTERVAL '30 days'),
          trigger_data->>'contact_identifier',
          trigger_data->>'client_name',
          NOW()
        ) RETURNING id INTO new_deal_id;
        
        -- Update the original activity to link to this deal if it doesn't have one
        IF trigger_data->>'deal_id' IS NULL OR trigger_data->>'deal_id' = 'null' THEN
          UPDATE activities 
          SET deal_id = new_deal_id 
          WHERE id = (trigger_data->>'activity_id')::uuid;
        END IF;
        
        result := result || jsonb_build_object('deal_id', new_deal_id, 'deal_name', deal_name, 'deal_value', deal_value);
      END IF;
      
    WHEN 'update_deal_stage' THEN
      -- Move an existing deal to a new stage
      IF trigger_data->>'deal_id' IS NOT NULL THEN
        existing_deal_id := (trigger_data->>'deal_id')::uuid;
        stage_id := (rule.action_config->>'target_stage_id')::uuid;
        
        UPDATE deals 
        SET stage_id = stage_id, updated_at = NOW() 
        WHERE id = existing_deal_id AND owner_id = user_id;
        
        result := result || jsonb_build_object('deal_id', existing_deal_id, 'new_stage_id', stage_id);
      END IF;
      
    WHEN 'create_task' THEN
      -- Create a follow-up task
      INSERT INTO tasks (
        title, description, type, priority, status, due_date, deal_id, assigned_to, created_by
      ) VALUES (
        COALESCE(rule.action_config->>'task_title', 'Follow-up Task'),
        COALESCE(rule.action_config->>'task_description', 'Automated follow-up task'),
        COALESCE(rule.action_config->>'task_type', 'follow_up'),
        COALESCE(rule.action_config->>'priority', 'medium'),
        'pending',
        CURRENT_DATE + INTERVAL '1 day' * COALESCE((rule.action_config->>'days_after')::integer, 3),
        COALESCE((trigger_data->>'deal_id')::uuid, new_deal_id),
        user_id,
        user_id
      ) RETURNING id INTO new_task_id;
      
      result := result || jsonb_build_object('task_id', new_task_id, 'due_date', CURRENT_DATE + INTERVAL '1 day' * COALESCE((rule.action_config->>'days_after')::integer, 3));
      
    WHEN 'create_activity' THEN
      -- Create a new activity (e.g., when deal stage changes)
      INSERT INTO activities (
        user_id, type, client_name, details, amount, priority, sales_rep, date, status, quantity, deal_id
      ) VALUES (
        user_id,
        COALESCE(rule.action_config->>'activity_type', 'follow_up'),
        COALESCE(trigger_data->>'client_name', trigger_data->>'deal_name', 'Unknown Client'),
        COALESCE(rule.action_config->>'activity_details', rule.action_config->>'activity_title', 'Automated activity'),
        COALESCE((rule.action_config->>'activity_amount')::decimal, (trigger_data->>'deal_value')::decimal, 0),
        COALESCE(rule.action_config->>'priority', 'medium'),
        (SELECT COALESCE(first_name || ' ' || last_name, email) FROM user_profiles WHERE id = user_id LIMIT 1),
        NOW(),
        'completed',
        1,
        COALESCE((trigger_data->>'deal_id')::uuid, new_deal_id)
      ) RETURNING id INTO new_activity_id;
      
      result := result || jsonb_build_object('activity_id', new_activity_id, 'activity_type', rule.action_config->>'activity_type');
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for unified automation system
DROP TRIGGER IF EXISTS trigger_unified_automation_activities ON activities;
CREATE TRIGGER trigger_unified_automation_activities
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION execute_unified_automation_rules();

DROP TRIGGER IF EXISTS trigger_unified_automation_deals ON deals;  
CREATE TRIGGER trigger_unified_automation_deals
  AFTER UPDATE OF stage_id ON deals
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION execute_unified_automation_rules();

-- Insert default automation templates that users can enable/customize
INSERT INTO user_automation_rules (user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active)
SELECT 
  auth.uid(),
  'Create deal from proposal',
  'Automatically create a deal in Opportunity stage when a proposal activity is created without an existing deal',
  'activity_created',
  '{"activity_type": "proposal"}'::jsonb,
  'create_deal',
  '{"target_stage_id": "' || (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%opportunity%' LIMIT 1) || '", "probability": 30}'::jsonb,
  false -- Disabled by default - users can enable
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, rule_name) DO NOTHING;

INSERT INTO user_automation_rules (user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active)
SELECT 
  auth.uid(),
  'Create deal from sale',
  'Automatically create a deal in Signed stage when a sale activity is created without an existing deal',
  'activity_created',
  '{"activity_type": "sale"}'::jsonb,
  'create_deal',
  '{"target_stage_id": "' || (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%signed%' LIMIT 1) || '", "probability": 100}'::jsonb,
  false -- Disabled by default - users can enable
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, rule_name) DO NOTHING;

INSERT INTO user_automation_rules (user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active)
SELECT 
  auth.uid(),
  'Follow up after proposal',
  'Create a follow-up task 3 days after sending a proposal',
  'activity_created',
  '{"activity_type": "proposal"}'::jsonb,
  'create_task',
  '{"task_title": "Follow up on proposal", "task_description": "Check if client has reviewed the proposal and answer questions", "task_type": "follow_up", "priority": "high", "days_after": 3}'::jsonb,
  false -- Disabled by default - users can enable
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, rule_name) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE user_automation_rules IS 'Unified automation rules for users to configure activity-based, pipeline, and task automations';
COMMENT ON TABLE automation_tests IS 'Test execution tracking for automation rules to build user confidence';
COMMENT ON TABLE automation_executions IS 'Audit log of all automation rule executions with detailed results';
COMMENT ON FUNCTION execute_unified_automation_rules() IS 'Unified trigger function that handles all types of automation rules';
COMMENT ON FUNCTION execute_automation_action(user_automation_rules, JSONB, UUID) IS 'Executes individual automation actions based on rule configuration';