-- Create a saved instance of the Sales Analysis Workflow for Phil O'Brien
-- This will make the workflow appear in "My Workflows" page

-- First, find Phil's user ID
WITH phil_user AS (
  SELECT id 
  FROM auth.users 
  WHERE email = 'phil@sixtyseconds.video'
  LIMIT 1
)
-- Insert the Sales Analysis Workflow as a saved user workflow
INSERT INTO user_automation_rules (
  user_id,
  name,
  description,
  trigger_type,
  trigger_config,
  action_type,
  action_config,
  conditions,
  is_active,
  order_index,
  created_at,
  updated_at
)
SELECT 
  phil_user.id,
  'Sales Analysis Workflow',
  'Comprehensive sales meeting analysis with automated insights and task creation',
  'webhook',
  jsonb_build_object(
    'webhook_url', '/api/workflows/webhook/sales-analysis',
    'source', 'fathom'
  ),
  'workflow',
  jsonb_build_object(
    'workflow_id', 'sales-analysis-workflow',
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'webhook-receiver',
        'type', 'trigger',
        'data', jsonb_build_object(
          'label', 'Webhook Receiver',
          'description', 'Receives Fathom webhook data'
        )
      ),
      jsonb_build_object(
        'id', 'task-categorizer',
        'type', 'processor',
        'data', jsonb_build_object(
          'label', 'Task Categorizer',
          'description', 'Categorizes meeting tasks and action items'
        )
      ),
      jsonb_build_object(
        'id', 'call-analyzer',
        'type', 'processor',
        'data', jsonb_build_object(
          'label', 'Call Analyzer',
          'description', 'Analyzes call quality and extracts insights'
        )
      ),
      jsonb_build_object(
        'id', 'metrics-calculator',
        'type', 'processor',
        'data', jsonb_build_object(
          'label', 'Metrics Calculator',
          'description', 'Calculates performance metrics'
        )
      ),
      jsonb_build_object(
        'id', 'sales-coach',
        'type', 'processor',
        'data', jsonb_build_object(
          'label', 'Sales Coach',
          'description', 'Provides coaching insights'
        )
      ),
      jsonb_build_object(
        'id', 'doc-creator',
        'type', 'action',
        'data', jsonb_build_object(
          'label', 'Google Doc Creator',
          'description', 'Creates meeting summary document'
        )
      ),
      jsonb_build_object(
        'id', 'database-saver',
        'type', 'action',
        'data', jsonb_build_object(
          'label', 'Database Saver',
          'description', 'Saves meeting to database'
        )
      ),
      jsonb_build_object(
        'id', 'task-creator',
        'type', 'action',
        'data', jsonb_build_object(
          'label', 'Task Creator',
          'description', 'Creates follow-up tasks'
        )
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'webhook-receiver', 'target', 'task-categorizer'),
      jsonb_build_object('id', 'e2', 'source', 'task-categorizer', 'target', 'call-analyzer'),
      jsonb_build_object('id', 'e3', 'source', 'call-analyzer', 'target', 'metrics-calculator'),
      jsonb_build_object('id', 'e4', 'source', 'metrics-calculator', 'target', 'sales-coach'),
      jsonb_build_object('id', 'e5', 'source', 'sales-coach', 'target', 'doc-creator'),
      jsonb_build_object('id', 'e6', 'source', 'doc-creator', 'target', 'database-saver'),
      jsonb_build_object('id', 'e7', 'source', 'database-saver', 'target', 'task-creator')
    )
  ),
  jsonb_build_object(
    'source', 'fathom',
    'type', 'sales_meeting'
  ),
  true, -- is_active
  1, -- order_index
  NOW(),
  NOW()
FROM phil_user
WHERE NOT EXISTS (
  -- Don't create if already exists for this user
  SELECT 1 
  FROM user_automation_rules 
  WHERE user_id = (SELECT id FROM phil_user) 
  AND name = 'Sales Analysis Workflow'
);

-- Verify the workflow was created
SELECT 
  r.id,
  r.name,
  r.description,
  r.is_active,
  r.created_at,
  u.email as owner_email
FROM user_automation_rules r
JOIN auth.users u ON r.user_id = u.id
WHERE u.email = 'phil@sixtyseconds.video'
AND r.name = 'Sales Analysis Workflow';