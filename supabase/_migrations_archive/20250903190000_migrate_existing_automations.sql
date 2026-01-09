-- Migration script to move existing automation data to unified system
-- This preserves existing smart task templates and pipeline automation rules

-- Migrate existing smart_task_templates to user_automation_rules
INSERT INTO user_automation_rules (
  user_id,
  rule_name,
  rule_description,
  trigger_type,
  trigger_conditions,
  action_type,
  action_config,
  is_active,
  execution_order,
  created_at,
  updated_at
)
SELECT 
  created_by as user_id,
  CONCAT('Smart Task: ', trigger_activity_type, ' → ', task_title) as rule_name,
  CONCAT('Auto-generate task: ', task_description) as rule_description,
  'activity_created' as trigger_type,
  jsonb_build_object('activity_type', trigger_activity_type) as trigger_conditions,
  'create_task' as action_type,
  jsonb_build_object(
    'task_title', task_title,
    'task_description', task_description,
    'task_type', task_type,
    'priority', priority,
    'days_after', days_after_trigger
  ) as action_config,
  is_active,
  0 as execution_order,
  created_at,
  updated_at
FROM smart_task_templates
WHERE created_by IS NOT NULL
ON CONFLICT (user_id, rule_name) DO NOTHING;

-- Migrate existing pipeline_automation_rules to user_automation_rules
INSERT INTO user_automation_rules (
  user_id,
  rule_name,
  rule_description,
  trigger_type,
  trigger_conditions,
  action_type,
  action_config,
  is_active,
  execution_order,
  created_at,
  updated_at
)
SELECT 
  created_by as user_id,
  rule_name,
  rule_description,
  'stage_changed' as trigger_type,
  jsonb_build_object(
    'from_stage_id', from_stage_id,
    'to_stage_id', to_stage_id
  ) as trigger_conditions,
  action_type,
  CASE action_type
    WHEN 'create_activity' THEN jsonb_build_object(
      'activity_type', activity_type,
      'activity_title', activity_title,
      'activity_details', activity_details,
      'activity_amount_source', activity_amount_source,
      'activity_fixed_amount', activity_fixed_amount,
      'priority', 'medium'
    )
    WHEN 'create_task' THEN jsonb_build_object(
      'task_title', task_title,
      'task_description', task_description,
      'task_type', task_type,
      'priority', task_priority,
      'days_after', task_days_after
    )
    WHEN 'update_field' THEN jsonb_build_object(
      'field_name', update_field_name,
      'field_value', update_field_value
    )
    WHEN 'send_notification' THEN jsonb_build_object(
      'message', notification_message,
      'notification_type', notification_type
    )
    ELSE '{}'::jsonb
  END as action_config,
  is_active,
  execution_order,
  created_at,
  updated_at
FROM pipeline_automation_rules
WHERE created_by IS NOT NULL
ON CONFLICT (user_id, rule_name) DO NOTHING;

-- Create default automation rules for users who don't have any
-- This gives them some examples to work with

-- Function to create default automation rules for a user
CREATE OR REPLACE FUNCTION create_default_automation_rules_for_user(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  sql_stage_id UUID;
  opportunity_stage_id UUID;
  signed_stage_id UUID;
  rules_created INTEGER := 0;
BEGIN
  -- Get stage IDs
  SELECT id INTO sql_stage_id FROM deal_stages WHERE LOWER(name) LIKE '%sql%' LIMIT 1;
  SELECT id INTO opportunity_stage_id FROM deal_stages WHERE LOWER(name) LIKE '%opportunity%' LIMIT 1;
  SELECT id INTO signed_stage_id FROM deal_stages WHERE LOWER(name) LIKE '%signed%' LIMIT 1;
  
  -- Create deal from proposal (disabled by default)
  INSERT INTO user_automation_rules (
    user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active
  ) VALUES (
    target_user_id,
    'Create deal from proposal',
    'Automatically create a deal when I send a proposal without an existing deal',
    'activity_created',
    '{"activity_type": "proposal"}'::jsonb,
    'create_deal',
    jsonb_build_object('target_stage_id', opportunity_stage_id, 'probability', 30),
    false
  ) ON CONFLICT (user_id, rule_name) DO NOTHING;
  
  IF FOUND THEN
    rules_created := rules_created + 1;
  END IF;
  
  -- Create deal from sale (disabled by default)
  INSERT INTO user_automation_rules (
    user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active
  ) VALUES (
    target_user_id,
    'Create deal from sale',
    'Automatically create a deal when I record a sale without an existing deal',
    'activity_created',
    '{"activity_type": "sale"}'::jsonb,
    'create_deal',
    jsonb_build_object('target_stage_id', signed_stage_id, 'probability', 100),
    false
  ) ON CONFLICT (user_id, rule_name) DO NOTHING;
  
  IF FOUND THEN
    rules_created := rules_created + 1;
  END IF;
  
  -- Follow up after proposal (disabled by default)
  INSERT INTO user_automation_rules (
    user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active
  ) VALUES (
    target_user_id,
    'Follow up after proposal',
    'Create a follow-up task 3 days after sending a proposal',
    'activity_created',
    '{"activity_type": "proposal"}'::jsonb,
    'create_task',
    '{"task_title": "Follow up on proposal", "task_description": "Check if client has reviewed the proposal", "task_type": "follow_up", "priority": "high", "days_after": 3}'::jsonb,
    false
  ) ON CONFLICT (user_id, rule_name) DO NOTHING;
  
  IF FOUND THEN
    rules_created := rules_created + 1;
  END IF;
  
  -- Meeting follow-up task (disabled by default)
  INSERT INTO user_automation_rules (
    user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active
  ) VALUES (
    target_user_id,
    'Meeting follow-up task',
    'Create a follow-up task 1 day after a meeting',
    'activity_created',
    '{"activity_type": "meeting"}'::jsonb,
    'create_task',
    '{"task_title": "Send meeting follow-up", "task_description": "Send thank you email and next steps", "task_type": "follow_up", "priority": "medium", "days_after": 1}'::jsonb,
    false
  ) ON CONFLICT (user_id, rule_name) DO NOTHING;
  
  IF FOUND THEN
    rules_created := rules_created + 1;
  END IF;
  
  RETURN rules_created;
END;
$$ LANGUAGE plpgsql;

-- Create default rules for existing users (but only if they don't have any automation rules yet)
INSERT INTO user_automation_rules (user_id, rule_name, rule_description, trigger_type, trigger_conditions, action_type, action_config, is_active)
SELECT 
  users.id,
  'Create deal from proposal',
  'Automatically create a deal when I send a proposal without an existing deal',
  'activity_created',
  '{"activity_type": "proposal"}'::jsonb,
  'create_deal',
  jsonb_build_object('target_stage_id', (SELECT id FROM deal_stages WHERE LOWER(name) LIKE '%opportunity%' LIMIT 1), 'probability', 30),
  false
FROM auth.users users
WHERE NOT EXISTS (
  SELECT 1 FROM user_automation_rules 
  WHERE user_automation_rules.user_id = users.id
)
ON CONFLICT (user_id, rule_name) DO NOTHING;

-- Log migration results
DO $$
DECLARE
  smart_task_count INTEGER;
  pipeline_rule_count INTEGER;
  new_rule_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO smart_task_count FROM smart_task_templates;
  SELECT COUNT(*) INTO pipeline_rule_count FROM pipeline_automation_rules;
  SELECT COUNT(*) INTO new_rule_count FROM user_automation_rules;
  
  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '- Smart task templates found: %', smart_task_count;
  RAISE NOTICE '- Pipeline automation rules found: %', pipeline_rule_count;
  RAISE NOTICE '- Total unified automation rules: %', new_rule_count;
END $$;

-- Add helpful comments
COMMENT ON FUNCTION create_default_automation_rules_for_user(UUID) IS 'Creates default automation rule templates for a user to help them get started';

-- Create index for performance on the new unified table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_automation_rules_user_trigger 
ON user_automation_rules(user_id, trigger_type, is_active);

COMMENT ON INDEX idx_user_automation_rules_user_trigger IS 'Performance index for querying user automation rules by trigger type';