-- Redesign Fathom workflow with proper nodes, spacing, and complete functionality
-- This creates a complete workflow for transcript, action items, and summary processing

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      -- 1. Webhook Received Trigger (standard trigger node)
      jsonb_build_object(
        'id', 'trigger-webhook',
        'type', 'trigger',
        'position', jsonb_build_object('x', 100, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Webhook Received',
          'icon', 'Zap',
          'trigger', 'webhook_received',
          'description', 'Fathom meeting webhook',
          'webhookUrl', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
          'config', jsonb_build_object(
            'source', 'fathom',
            'acceptedPayloads', jsonb_build_array('transcript', 'action_items', 'summary')
          )
        )
      ),
      
      -- 2. Conditional Branch for payload type detection
      jsonb_build_object(
        'id', 'condition-payload-type',
        'type', 'condition',
        'position', jsonb_build_object('x', 400, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Check Payload Type',
          'icon', 'GitBranch',
          'conditions', jsonb_build_array(
            jsonb_build_object(
              'id', 'transcript-path',
              'field', 'payload.type',
              'operator', 'equals',
              'value', 'transcript',
              'output', 'transcript'
            ),
            jsonb_build_object(
              'id', 'action-items-path',
              'field', 'payload.type', 
              'operator', 'equals',
              'value', 'action_items',
              'output', 'actionItems'
            ),
            jsonb_build_object(
              'id', 'summary-path',
              'field', 'payload.type',
              'operator', 'equals', 
              'value', 'summary',
              'output', 'summary'
            )
          )
        )
      ),
      
      -- TRANSCRIPT BRANCH
      -- 3. Create Google Doc for transcript
      jsonb_build_object(
        'id', 'create-transcript-doc',
        'type', 'action',
        'position', jsonb_build_object('x', 700, 'y', 100),
        'data', jsonb_build_object(
          'label', 'Create Transcript Doc',
          'icon', 'FileText',
          'action', 'google_docs_create',
          'description', 'Create Google Doc with transcript',
          'config', jsonb_build_object(
            'title', 'Meeting Transcript - {{payload.meetingTitle}}',
            'content', '{{payload.transcript}}',
            'folderId', null,
            'shareWith', jsonb_build_array()
          )
        )
      ),
      
      -- ACTION ITEMS BRANCH
      -- 4. Process action items
      jsonb_build_object(
        'id', 'process-action-items',
        'type', 'action',
        'position', jsonb_build_object('x', 700, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Process Action Items',
          'icon', 'CheckSquare',
          'action', 'process_action_items',
          'description', 'Create tasks from action items',
          'config', jsonb_build_object(
            'createTasks', true,
            'assignToUsers', true,
            'addToProject', null,
            'defaultPriority', 'medium',
            'dueDateDays', 3
          )
        )
      ),
      
      -- 5. Create tasks for each action item
      jsonb_build_object(
        'id', 'create-tasks',
        'type', 'action',
        'position', jsonb_build_object('x', 1000, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Create Tasks',
          'icon', 'CheckSquare',
          'action', 'create_task',
          'description', 'Create task for each action item',
          'config', jsonb_build_object(
            'taskTitle', '{{actionItem.title}}',
            'taskDescription', '{{actionItem.description}}',
            'assignTo', '{{actionItem.assignee}}',
            'dueDate', '{{actionItem.dueDate}}',
            'priority', '{{actionItem.priority}}'
          )
        )
      ),
      
      -- SUMMARY BRANCH  
      -- 6. Update meeting record with summary
      jsonb_build_object(
        'id', 'update-meeting-summary',
        'type', 'action',
        'position', jsonb_build_object('x', 700, 'y', 500),
        'data', jsonb_build_object(
          'label', 'Update Meeting',
          'icon', 'Database',
          'action', 'update_meeting',
          'description', 'Save summary to meeting record',
          'config', jsonb_build_object(
            'upsertKey', 'fathom_recording_id',
            'fields', jsonb_build_object(
              'title', '{{payload.meetingTitle}}',
              'summary', '{{payload.summary}}',
              'fathom_recording_id', '{{payload.recordingId}}',
              'meeting_date', '{{payload.meetingDate}}',
              'attendees', '{{payload.attendees}}',
              'duration_minutes', '{{payload.duration}}'
            )
          )
        )
      ),
      
      -- CONVERGENCE POINT
      -- 7. Send notification (all branches converge here)
      jsonb_build_object(
        'id', 'send-notification',
        'type', 'action',
        'position', jsonb_build_object('x', 1300, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Send Notification',
          'icon', 'Bell',
          'action', 'send_notification',
          'description', 'Notify team of processed meeting',
          'config', jsonb_build_object(
            'channel', 'slack',
            'message', 'Meeting "{{payload.meetingTitle}}" has been processed',
            'includeLink', true
          )
        )
      ),
      
      -- 8. Final meeting update with all data
      jsonb_build_object(
        'id', 'final-meeting-update',
        'type', 'action',
        'position', jsonb_build_object('x', 1600, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Final Meeting Update',
          'icon', 'Database',
          'action', 'update_meeting',
          'description', 'Update meeting with all processed data',
          'config', jsonb_build_object(
            'upsertKey', 'fathom_recording_id',
            'fields', jsonb_build_object(
              'processed', true,
              'transcript_doc_url', '{{googleDoc.url}}',
              'action_items_count', '{{actionItems.count}}',
              'tasks_created', '{{tasks.ids}}',
              'processed_at', '{{now}}'
            )
          )
        )
      )
    ),
    
    'edges', jsonb_build_array(
      -- Main flow
      jsonb_build_object(
        'id', 'e1',
        'source', 'trigger-webhook',
        'target', 'condition-payload-type',
        'type', 'smoothstep',
        'animated', true
      ),
      
      -- Transcript branch
      jsonb_build_object(
        'id', 'e2',
        'source', 'condition-payload-type',
        'sourceHandle', 'transcript',
        'target', 'create-transcript-doc',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Transcript'
      ),
      jsonb_build_object(
        'id', 'e3',
        'source', 'create-transcript-doc',
        'target', 'send-notification',
        'type', 'smoothstep',
        'animated', true
      ),
      
      -- Action items branch
      jsonb_build_object(
        'id', 'e4',
        'source', 'condition-payload-type',
        'sourceHandle', 'actionItems',
        'target', 'process-action-items',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Action Items'
      ),
      jsonb_build_object(
        'id', 'e5',
        'source', 'process-action-items',
        'target', 'create-tasks',
        'type', 'smoothstep',
        'animated', true
      ),
      jsonb_build_object(
        'id', 'e6',
        'source', 'create-tasks',
        'target', 'send-notification',
        'type', 'smoothstep',
        'animated', true
      ),
      
      -- Summary branch
      jsonb_build_object(
        'id', 'e7',
        'source', 'condition-payload-type',
        'sourceHandle', 'summary',
        'target', 'update-meeting-summary',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Summary'
      ),
      jsonb_build_object(
        'id', 'e8',
        'source', 'update-meeting-summary',
        'target', 'send-notification',
        'type', 'smoothstep',
        'animated', true
      ),
      
      -- Final convergence
      jsonb_build_object(
        'id', 'e9',
        'source', 'send-notification',
        'target', 'final-meeting-update',
        'type', 'smoothstep',
        'animated', true
      )
    )
  ),
  rule_description = 'Complete Fathom integration: Processes transcripts (creates Google Docs), action items (creates tasks), and summaries (updates meetings). All branches converge to send notifications and update the meeting record.'
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
    id,
    rule_name,
    rule_description,
    jsonb_array_length(canvas_data->'nodes') as node_count,
    jsonb_array_length(canvas_data->'edges') as edge_count
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';