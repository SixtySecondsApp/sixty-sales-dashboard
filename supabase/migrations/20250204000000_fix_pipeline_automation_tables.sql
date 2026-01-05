-- Fix pipeline automation tables and deal_stages population
-- This migration ensures all required tables exist and are properly populated
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  -- Only proceed if deal_stages table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_stages') THEN
    RAISE NOTICE 'Skipping pipeline automation migration - deal_stages table does not exist yet';
    RETURN;
  END IF;

  -- 1. Ensure deal_stages table has data
  IF NOT EXISTS (SELECT 1 FROM deal_stages LIMIT 1) THEN
    -- Insert the standard 4-stage pipeline
    INSERT INTO deal_stages (name, color, order_position, description, default_probability) VALUES
      ('SQL', '#3B82F6', 10, 'Sales Qualified Lead', 20),
      ('Opportunity', '#F59E0B', 20, 'Active opportunity', 40),
      ('Verbal', '#8B5CF6', 30, 'Verbal agreement', 70),
      ('Signed', '#10B981', 40, 'Deal signed', 100)
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- 2. Create pipeline_automation_rules table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_rules') THEN
    CREATE TABLE pipeline_automation_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_name TEXT NOT NULL,
      rule_description TEXT,

      -- Trigger conditions
      from_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,
      to_stage_id UUID REFERENCES deal_stages(id) ON DELETE CASCADE,

      -- Action configuration
      action_type TEXT NOT NULL CHECK (action_type IN ('create_activity', 'create_task', 'send_notification', 'update_field')),

      -- Activity creation parameters (when action_type = 'create_activity')
      activity_type TEXT,
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
  END IF;

  -- 3. Create pipeline_automation_executions table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_executions')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals')
  THEN
    CREATE TABLE pipeline_automation_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  END IF;

  -- 4. Create indexes for performance (only if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_rules') THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_rules_from_to_stage ON pipeline_automation_rules(from_stage_id, to_stage_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_rules_active ON pipeline_automation_rules(is_active) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_pipeline_rules_execution_order ON pipeline_automation_rules(execution_order);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_executions') THEN
    CREATE INDEX IF NOT EXISTS idx_pipeline_executions_deal_id ON pipeline_automation_executions(deal_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_executions_rule_id ON pipeline_automation_executions(rule_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_executions_executed_at ON pipeline_automation_executions(executed_at);
  END IF;

  -- 5. Enable RLS (only if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_rules') THEN
    ALTER TABLE pipeline_automation_rules ENABLE ROW LEVEL SECURITY;

    -- Admin management policy for rules
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'pipeline_automation_rules'
      AND policyname = 'Admins can manage pipeline automation rules'
    ) THEN
      CREATE POLICY "Admins can manage pipeline automation rules" ON pipeline_automation_rules
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
          )
        );
    END IF;

    -- All authenticated users can view active rules
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'pipeline_automation_rules'
      AND policyname = 'All users can view active pipeline automation rules'
    ) THEN
      CREATE POLICY "All users can view active pipeline automation rules" ON pipeline_automation_rules
        FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_executions') THEN
    ALTER TABLE pipeline_automation_executions ENABLE ROW LEVEL SECURITY;

    -- Users can view execution logs for their own deals
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'pipeline_automation_executions'
      AND policyname = 'Users can view execution logs for their deals'
    ) THEN
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
    END IF;
  END IF;

  -- 7. Insert default automation rules (disabled by default) - only if tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_rules') THEN
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
      task_title,
      task_description,
      task_type,
      task_priority,
      task_days_after,
      is_active,
      execution_order
    )
    SELECT
      'Auto-create proposal activity',
      'Automatically creates a proposal activity when a deal moves from SQL to Opportunity stage',
      (SELECT id FROM deal_stages WHERE name = 'SQL' LIMIT 1),
      (SELECT id FROM deal_stages WHERE name = 'Opportunity' LIMIT 1),
      'create_activity',
      'proposal',
      'Proposal sent',
      'Proposal sent for deal',
      'deal_value',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      false, -- Disabled by default
      1
    WHERE NOT EXISTS (
      SELECT 1 FROM pipeline_automation_rules
      WHERE rule_name = 'Auto-create proposal activity'
    )
    UNION ALL
    SELECT
      'Create follow-up task for verbal stage',
      'Creates a follow-up task 3 days after deal moves to Verbal stage',
      (SELECT id FROM deal_stages WHERE name = 'Opportunity' LIMIT 1),
      (SELECT id FROM deal_stages WHERE name = 'Verbal' LIMIT 1),
      'create_task',
      NULL,
      NULL,
      NULL,
      NULL,
      'Follow up on verbal agreement',
      'Follow up to confirm verbal agreement and move towards contract signing',
      'follow_up',
      'high',
      3,
      false, -- Disabled by default
      2
    WHERE NOT EXISTS (
      SELECT 1 FROM pipeline_automation_rules
      WHERE rule_name = 'Create follow-up task for verbal stage'
    );
  END IF;

  RAISE NOTICE 'Pipeline automation tables setup completed';
END $$;

-- Add helpful comments (safe to run regardless of table existence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_rules') THEN
    COMMENT ON TABLE pipeline_automation_rules IS 'User-configurable automation rules for pipeline stage transitions';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_automation_executions') THEN
    COMMENT ON TABLE pipeline_automation_executions IS 'Audit log of pipeline automation rule executions';
  END IF;
END $$;
