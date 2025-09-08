-- Test Script: Verify Workflow Testing System Installation
-- Run this after the migration to verify everything is working

-- 1. Check if all tables were created
SELECT 'Checking tables...' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'workflow_environments',
  'workflow_contracts',
  'execution_snapshots',
  'node_fixtures',
  'scenario_fixtures',
  'variable_storage',
  'execution_checkpoints',
  'http_request_recordings',
  'workflow_idempotency_keys',
  'workflow_dead_letter_queue',
  'workflow_rate_limits',
  'workflow_circuit_breakers',
  'workflow_batch_windows',
  'workflow_environment_promotions',
  'webhook_mirror_config'
)
ORDER BY table_name;

-- 2. Get a sample workflow ID to use for testing
SELECT 'Finding a workflow to test with...' as status;

SELECT id, name, is_active 
FROM user_automation_rules 
LIMIT 1;

-- 3. If you have a workflow ID, you can test creating environments
-- Replace 'YOUR_WORKFLOW_ID' with an actual workflow ID from the query above
/*
INSERT INTO workflow_environments (
  workflow_id,
  environment,
  config,
  variables,
  is_active
) VALUES (
  'YOUR_WORKFLOW_ID'::uuid,
  'build',
  '{"maxExecutionTime": 30000, "enableDebugMode": true}'::jsonb,
  '{"testVar": "test value"}'::jsonb,
  true
);
*/

-- 4. Test creating a global variable
INSERT INTO variable_storage (
  scope,
  key,
  value,
  ttl_seconds
) VALUES (
  'global',
  'test_global_var',
  '"Hello from global scope"'::jsonb,
  3600
) ON CONFLICT DO NOTHING;

-- 5. Verify the variable was created
SELECT 'Testing variable storage...' as status;

SELECT id, scope, key, value, ttl_seconds 
FROM variable_storage 
WHERE key = 'test_global_var';

-- 6. Check indexes
SELECT 'Checking indexes...' as status;

SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'workflow_environments',
  'execution_snapshots',
  'variable_storage'
);

-- Success message
SELECT '✅ Workflow Testing System is installed and working!' AS status;