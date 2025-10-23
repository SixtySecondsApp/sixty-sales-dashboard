-- Fix Fathom workflow: Update user_id and add visualization data
-- This script makes the Fathom workflow visible in the My Workflows section

-- First, check if the workflow exists
SELECT 
    id,
    user_id,
    rule_name,
    is_active,
    trigger_type,
    action_type
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Update the workflow with correct user_id and comprehensive visualization data
UPDATE user_automation_rules
SET 
  user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', -- Set to your user ID
  rule_name = 'Fathom Meeting Integration',
  rule_description = 'Comprehensive Fathom meeting integration that processes transcripts, action items, and summaries. Automatically creates Google Docs for transcripts, processes and assigns action items with AI classification, and maintains meeting records with UPSERT operations.',
  trigger_type = 'webhook',
  action_type = 'create_task',
  canvas_data = jsonb_build_object(
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
          'webhookUrl', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
          'acceptedPayloads', jsonb_build_array('transcript', 'action_items', 'summary')
        )
      ),
      -- Conditional Branch Node
      jsonb_build_object(
        'id', 'conditional-branch-1',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 350, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Detect Payload Type',
          'conditions', jsonb_build_array(
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'transcript', 'output', 'transcript'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'action_items', 'output', 'action_items'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'summary', 'output', 'summary')
          )
        )
      ),
      -- Google Docs Creator Node (for transcripts)
      jsonb_build_object(
        'id', 'google-docs-1',
        'type', 'googleDocsCreator',
        'position', jsonb_build_object('x', 600, 'y', 100),
        'data', jsonb_build_object(
          'label', 'Create Google Doc',
          'documentTitle', 'Meeting Transcript - {{meeting.title}}',
          'folderId', null,
          'permissions', jsonb_build_array()
        )
      ),
      -- Action Item Processor Node
      jsonb_build_object(
        'id', 'action-processor-1',
        'type', 'actionItemProcessor',
        'position', jsonb_build_object('x', 600, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Process Action Items',
          'enableAI', true,
          'createTasks', true,
          'assignToUsers', true,
          'priorityMapping', jsonb_build_object(
            'urgent', 'eeb122d5-d850-4381-b914-2ad09e48421b',
            'high', '42641fa1-9e6c-48fd-8c08-ada611ccc92a',
            'medium', 'e6153e53-d1c7-431a-afde-cd7c21b02ebb',
            'low', '1c00bc94-5358-4348-aaf3-cb2baa4747c4'
          ),
          'userMapping', jsonb_build_object(
            'Andrew Bryce', 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
            'Steve Gibson', 'e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f'
          )
        )
      ),
      -- Meeting Upsert Node
      jsonb_build_object(
        'id', 'meeting-upsert-1',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 850, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Upsert Meeting',
          'upsertKey', 'fathom_recording_id',
          'mappings', jsonb_build_object(
            'title', '{{payload.title}}',
            'fathom_recording_id', '{{payload.shareId}}',
            'share_url', '{{payload.shareUrl}}',
            'embed_url', '{{payload.embedUrl}}',
            'meeting_start', '{{payload.startTime}}',
            'meeting_end', '{{payload.endTime}}',
            'duration_minutes', '{{payload.duration}}',
            'summary', '{{payload.summary}}',
            'transcript_doc_url', '{{googleDoc.url}}'
          )
        )
      )
    ),
    'edges', jsonb_build_array(
      -- Connect webhook to conditional branch
      jsonb_build_object(
        'id', 'e1',
        'source', 'fathom-webhook-1',
        'target', 'conditional-branch-1',
        'sourceHandle', 'right',
        'targetHandle', 'left',
        'type', 'default'
      ),
      -- Connect branch to transcript processor
      jsonb_build_object(
        'id', 'e2',
        'source', 'conditional-branch-1',
        'target', 'google-docs-1',
        'sourceHandle', 'transcript',
        'targetHandle', 'left',
        'type', 'default'
      ),
      -- Connect branch to action items processor
      jsonb_build_object(
        'id', 'e3',
        'source', 'conditional-branch-1',
        'target', 'action-processor-1',
        'sourceHandle', 'action_items',
        'targetHandle', 'left',
        'type', 'default'
      ),
      -- Connect branch to meeting upsert (for summary)
      jsonb_build_object(
        'id', 'e4',
        'source', 'conditional-branch-1',
        'target', 'meeting-upsert-1',
        'sourceHandle', 'summary',
        'targetHandle', 'left',
        'type', 'default'
      ),
      -- Connect processors to meeting upsert
      jsonb_build_object(
        'id', 'e5',
        'source', 'google-docs-1',
        'target', 'meeting-upsert-1',
        'sourceHandle', 'right',
        'targetHandle', 'left',
        'type', 'default'
      ),
      jsonb_build_object(
        'id', 'e6',
        'source', 'action-processor-1',
        'target', 'meeting-upsert-1',
        'sourceHandle', 'right',
        'targetHandle', 'left',
        'type', 'default'
      )
    )
  ),
  action_config = jsonb_build_object(
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
      ),
      'categories', jsonb_build_array(
        'Follow-up',
        'Technical',
        'Administrative',
        'Review',
        'Decision'
      ),
      'default_deadline_days', 3
    )
  ),
  is_active = true,
  updated_at = NOW()
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update was successful
SELECT 
    id,
    user_id,
    rule_name,
    is_active,
    trigger_type,
    action_type,
    jsonb_pretty(canvas_data) as canvas_visualization
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Also check all workflows for this user to confirm it will show up
SELECT 
    id,
    rule_name,
    is_active,
    created_at
FROM user_automation_rules
WHERE user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
ORDER BY created_at DESC;