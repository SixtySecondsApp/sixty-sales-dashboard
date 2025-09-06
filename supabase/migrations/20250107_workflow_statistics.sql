-- Add execution statistics columns to user_automation_rules
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
ADD COLUMN IF NOT EXISTS test_scenario_id VARCHAR(100);

-- Create function to update workflow statistics after execution
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
      last_execution_at = NEW.executed_at,
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

-- Create view for workflow performance metrics
CREATE OR REPLACE VIEW workflow_performance_metrics AS
SELECT 
  w.id,
  w.rule_name,
  w.user_id,
  w.execution_count,
  w.success_count,
  w.failure_count,
  w.success_rate,
  w.avg_execution_time_ms,
  w.last_execution_at,
  w.last_execution_status,
  COUNT(DISTINCT DATE(e.executed_at)) as active_days,
  COUNT(CASE WHEN e.executed_at > NOW() - INTERVAL '7 days' THEN 1 END) as executions_last_7_days,
  COUNT(CASE WHEN e.executed_at > NOW() - INTERVAL '30 days' THEN 1 END) as executions_last_30_days
FROM user_automation_rules w
LEFT JOIN automation_executions e ON w.id = e.rule_id
GROUP BY w.id;

-- Grant permissions
GRANT SELECT ON workflow_performance_metrics TO authenticated;

-- Update existing records with initial statistics (one-time backfill)
UPDATE user_automation_rules ur
SET 
  execution_count = COALESCE(stats.total_count, 0),
  success_count = COALESCE(stats.success_count, 0),
  failure_count = COALESCE(stats.failure_count, 0),
  last_execution_at = stats.last_executed,
  last_execution_status = stats.last_status,
  avg_execution_time_ms = stats.avg_time
FROM (
  SELECT 
    rule_id,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failure_count,
    MAX(executed_at) as last_executed,
    (array_agg(status ORDER BY executed_at DESC))[1] as last_status,
    AVG(execution_time_ms)::INTEGER as avg_time
  FROM automation_executions
  GROUP BY rule_id
) stats
WHERE ur.id = stats.rule_id;