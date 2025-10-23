-- Create Fathom workflow from scratch
-- This creates a new workflow with proper visualization data

-- First check if it exists and delete if needed
DELETE FROM user_automation_rules 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Now INSERT the Fathom workflow (not UPDATE since it doesn't exist)
INSERT INTO user_automation_rules (
  id,
  user_id,
  rule_name,
  rule_description,
  trigger_type,
  trigger_conditions,
  action_type,
  action_config,
  canvas_data,
  is_active,
  priority_level
) VALUES (
  'c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', -- Your user ID
  'Fathom Meeting Integration',
  'Comprehensive Fathom meeting integration that processes transcripts, action items, and summaries.',
  'webhook',
  jsonb_build_object('webhook_type', 'fathom'),
  'create_task',
  jsonb_build_object(
    'webhook_url', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
    'fathom_config', jsonb_build_object(
      'priority_mapping', jsonb_build_object(
        'urgent', 'eeb122d5-d850-4381-b914-2ad09e48421b',
        'high', '42641fa1-9e6c-48fd-8c08-ada611ccc92a',
        'medium', 'e6153e53-d1c7-431a-afde-cd7c21b02ebb',
        'low', '1c00bc94-5358-4348-aaf3-cb2baa4747c4'
      ),
      'user_mapping', jsonb_build_object(
        'Andrew Bryce', 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
        'Steve Gibson', 'e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f'
      )
    )
  ),
  jsonb_build_object(
    'nodes', jsonb_build_array(
      -- Fathom Webhook Trigger Node
      jsonb_build_object(
        'id', 'fathom-webhook-1',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 100, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Fathom Webhook',
          'isConfigured', true,
          'workflowId', 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
          'webhookUrl', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f'
        )
      ),
      -- Conditional Branch Node
      jsonb_build_object(
        'id', 'conditional-branch-1',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 400, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Payload Type Check',
          'conditions', jsonb_build_array(
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'transcript'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'action_items'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'summary')
          )
        )
      ),
      -- Meeting Upsert Node
      jsonb_build_object(
        'id', 'meeting-upsert-1',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 700, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Upsert Meeting',
          'upsertKey', 'fathom_recording_id',
          'mappings', jsonb_build_object(
            'title', '{{payload.title}}',
            'fathom_recording_id', '{{payload.shareId}}',
            'summary', '{{payload.summary}}'
          )
        )
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object(
        'id', 'e1',
        'source', 'fathom-webhook-1',
        'target', 'conditional-branch-1',
        'type', 'default'
      ),
      jsonb_build_object(
        'id', 'e2',
        'source', 'conditional-branch-1',
        'target', 'meeting-upsert-1',
        'type', 'default'
      )
    )
  ),
  true, -- is_active
  1 -- priority_level
);

-- Verify it was created
SELECT 
    id,
    user_id,
    rule_name,
    is_active,
    created_at
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Show all workflows for the user
SELECT 
    id,
    rule_name,
    is_active,
    created_at
FROM user_automation_rules
WHERE user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
ORDER BY created_at DESC;