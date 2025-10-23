-- Fix for "execution_count" column error when creating activities/meetings
-- This adds the missing workflow statistics columns to the user_automation_rules table

-- First, check and add missing columns to user_automation_rules
ALTER TABLE user_automation_rules 
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_execution_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_error_message TEXT,
ADD COLUMN IF NOT EXISTS avg_execution_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) GENERATED ALWAYS AS (
  CASE 
    WHEN execution_count = 0 THEN 0
    ELSE ROUND((success_count::DECIMAL / execution_count) * 100, 2)
  END
) STORED;

-- Add missing columns to automation_executions if they don't exist
ALTER TABLE automation_executions
ADD COLUMN IF NOT EXISTS nodes_executed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nodes_total INTEGER,
ADD COLUMN IF NOT EXISTS is_test_run BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS test_scenario_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create or replace the function to update workflow statistics after execution
CREATE OR REPLACE FUNCTION update_workflow_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update on INSERT or when status changes to success/failed
  IF TG_OP = 'INSERT' OR 
     (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND 
      NEW.status IN ('success', 'failed')) THEN
    
    UPDATE user_automation_rules
    SET 
      execution_count = execution_count + 1,
      success_count = CASE 
        WHEN NEW.status = 'success' THEN success_count + 1 
        ELSE success_count 
      END,
      failure_count = CASE 
        WHEN NEW.status = 'failed' THEN failure_count + 1 
        ELSE failure_count 
      END,
      last_execution_at = COALESCE(NEW.executed_at, NOW()),
      last_execution_status = NEW.status,
      last_error_message = CASE 
        WHEN NEW.status = 'failed' THEN NEW.error_message 
        ELSE NULL 
      END,
      avg_execution_time_ms = (
        SELECT AVG(execution_time_ms)::INTEGER 
        FROM automation_executions 
        WHERE rule_id = NEW.rule_id 
        AND status IN ('success', 'failed')
        AND execution_time_ms IS NOT NULL
      ),
      updated_at = NOW()
    WHERE id = NEW.rule_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update statistics (drop if exists first)
DROP TRIGGER IF EXISTS update_workflow_stats_trigger ON automation_executions;
CREATE TRIGGER update_workflow_stats_trigger
AFTER INSERT OR UPDATE ON automation_executions
FOR EACH ROW
EXECUTE FUNCTION update_workflow_statistics();

-- Verify the columns exist
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_automation_rules'
AND column_name IN ('execution_count', 'success_count', 'failure_count', 'last_execution_at')
ORDER BY ordinal_position;