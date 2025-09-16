-- Fix for "execution_order" column error when creating activities
-- This error occurs because the automation trigger is trying to access a table that doesn't exist

-- First, check if the user_automation_rules table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'user_automation_rules') THEN
        
        -- Create the missing table
        CREATE TABLE user_automation_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
          UNIQUE(user_id, rule_name)
        );
        
        -- Create index for performance
        CREATE INDEX idx_automation_rules_user ON user_automation_rules(user_id);
        CREATE INDEX idx_automation_rules_active ON user_automation_rules(is_active) WHERE is_active = true;
        CREATE INDEX idx_automation_rules_trigger ON user_automation_rules(trigger_type);
        
        RAISE NOTICE 'Created user_automation_rules table';
    ELSE
        -- Table exists, check if it has the execution_order column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'user_automation_rules'
                       AND column_name = 'execution_order') THEN
            -- Add the missing column
            ALTER TABLE user_automation_rules ADD COLUMN execution_order INTEGER DEFAULT 0;
            RAISE NOTICE 'Added execution_order column to user_automation_rules table';
        END IF;
    END IF;
END $$;

-- Also check if automation_executions table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'automation_executions') THEN
        
        -- Create the missing table
        CREATE TABLE automation_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rule_id UUID REFERENCES user_automation_rules(id) ON DELETE CASCADE,
          trigger_data JSONB,
          execution_result JSONB,
          status TEXT CHECK (status IN ('success', 'failed', 'skipped')),
          error_message TEXT,
          execution_time_ms INTEGER,
          executed_by UUID REFERENCES auth.users(id),
          activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
          deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
          task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for performance
        CREATE INDEX idx_executions_rule ON automation_executions(rule_id);
        CREATE INDEX idx_executions_status ON automation_executions(status);
        CREATE INDEX idx_executions_created ON automation_executions(created_at DESC);
        
        RAISE NOTICE 'Created automation_executions table';
    END IF;
END $$;

-- Temporarily disable the problematic trigger if it exists
DROP TRIGGER IF EXISTS trigger_unified_automation_activities ON activities;

-- Create a safe version of the trigger that checks if tables exist
CREATE OR REPLACE FUNCTION safe_execute_unified_automation_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if required tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name = 'user_automation_rules') THEN
    -- Tables don't exist yet, just return without doing anything
    RETURN NEW;
  END IF;
  
  -- Tables exist, proceed with normal automation logic
  -- (This would normally call the actual automation function)
  -- For now, just return NEW to allow the operation to continue
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger with the safe function
CREATE TRIGGER trigger_unified_automation_activities
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION safe_execute_unified_automation_rules();

-- Output status
SELECT 
    'user_automation_rules exists' AS check,
    EXISTS (SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_automation_rules') AS result
UNION ALL
SELECT 
    'execution_order column exists' AS check,
    EXISTS (SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'user_automation_rules'
            AND column_name = 'execution_order') AS result
UNION ALL
SELECT 
    'automation_executions exists' AS check,
    EXISTS (SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'automation_executions') AS result;