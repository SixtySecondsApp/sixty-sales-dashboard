-- Fix Fathom workflow layout for better visibility and user experience

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      -- Fathom Webhook Trigger Node (left side)
      jsonb_build_object(
        'id', 'fathom-webhook-1',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 150, 'y', 250),
        'data', jsonb_build_object(
          'label', 'Fathom Webhook',
          'isConfigured', true,
          'workflowId', 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
          'webhookUrl', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f'
        )
      ),
      -- Conditional Branch Node (middle)
      jsonb_build_object(
        'id', 'conditional-branch-1',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 500, 'y', 250),
        'data', jsonb_build_object(
          'label', 'Payload Type Check',
          'conditions', jsonb_build_array(
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'transcript'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'action_items'),
            jsonb_build_object('field', 'payloadType', 'operator', 'equals', 'value', 'summary')
          )
        )
      ),
      -- Meeting Upsert Node (right side)
      jsonb_build_object(
        'id', 'meeting-upsert-1',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 850, 'y', 250),
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
        'type', 'default',
        'animated', true
      ),
      jsonb_build_object(
        'id', 'e2',
        'source', 'conditional-branch-1',
        'target', 'meeting-upsert-1',
        'type', 'default',
        'animated', true
      )
    )
  )
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
    id,
    rule_name,
    jsonb_pretty(canvas_data) as canvas_data
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';