-- Complete Fathom Workflow Redesign with Custom Nodes and Full Configuration
-- This creates a properly visualized workflow with all custom node types and visible variables

UPDATE user_automation_rules
SET canvas_data = jsonb_build_object(
    'nodes', jsonb_build_array(
      
      -- 1. FATHOM WEBHOOK NODE (Custom trigger for Fathom)
      jsonb_build_object(
        'id', 'fathom-webhook-trigger',
        'type', 'fathomWebhook',
        'position', jsonb_build_object('x', 100, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Fathom Webhook',
          'webhookUrl', 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/workflow-webhook/c914a0af-7cd4-43b8-97f2-863e6a4abf9f',
          'payloadTypes', jsonb_build_array('transcript', 'action_items', 'summary'),
          'isConfigured', true,
          'config', jsonb_build_object(
            'acceptedTopics', jsonb_build_array('meeting.transcript.ready', 'meeting.actions.ready', 'meeting.summary.ready'),
            'extractFathomId', true,
            'validatePayload', true,
            'webhookSecret', '{{env.FATHOM_WEBHOOK_SECRET}}'
          )
        )
      ),
      
      -- 2. CONDITIONAL BRANCH NODE (Routes based on payload type)
      jsonb_build_object(
        'id', 'payload-router',
        'type', 'conditionalBranch',
        'position', jsonb_build_object('x', 350, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Route by Content Type',
          'isConfigured', true,
          'conditions', jsonb_build_array(
            jsonb_build_object(
              'id', 'has-transcript',
              'field', '{{payload.transcript}}',
              'operator', 'exists',
              'value', true,
              'output', 'transcript'
            ),
            jsonb_build_object(
              'id', 'has-action-items',
              'field', '{{payload.action_items}}',
              'operator', 'exists',
              'value', true,
              'output', 'action_items'
            ),
            jsonb_build_object(
              'id', 'has-summary',
              'field', '{{payload.summary}}',
              'operator', 'exists',
              'value', true,
              'output', 'summary'
            )
          )
        )
      ),
      
      -- TRANSCRIPT BRANCH
      -- 3. GOOGLE DOCS CREATOR NODE
      jsonb_build_object(
        'id', 'create-transcript-doc',
        'type', 'googleDocsCreator',
        'position', jsonb_build_object('x', 600, 'y', 100),
        'data', jsonb_build_object(
          'label', 'Create Transcript Doc',
          'docTitle', 'Meeting Transcript - {{payload.title}}',
          'isConfigured', true,
          'config', jsonb_build_object(
            'formatTranscript', true,
            'addTimestamps', true,
            'shareWithAI', true,
            'vectorDbReady', true,
            'content', '# Meeting: {{payload.title}}\n\n**Date**: {{payload.date}}\n**Duration**: {{payload.duration}} minutes\n**Participants**: {{payload.participants}}\n\n## Transcript\n\n{{payload.transcript}}\n\n---\n*Generated from Fathom Recording ID: {{payload.fathom_id}}*',
            'folderId', '{{env.GOOGLE_DRIVE_FOLDER_ID}}',
            'permissions', jsonb_build_array(
              jsonb_build_object('email', '{{payload.organizer_email}}', 'role', 'writer'),
              jsonb_build_object('email', 'team@company.com', 'role', 'reader')
            )
          )
        )
      ),
      
      -- ACTION ITEMS BRANCH
      -- 4. ACTION ITEM PROCESSOR NODE (with enhanced AI and role detection)
      jsonb_build_object(
        'id', 'process-actions',
        'type', 'actionItemProcessor',
        'position', jsonb_build_object('x', 600, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Smart Task Assignment',
          'isConfigured', true,
          'config', jsonb_build_object(
            'aiEnabled', true,
            'aiModel', 'gpt-4',
            'aiPrompt', 'Analyze these action items from the meeting with smart role-based assignment:\n\n**Action Items:** {{payload.action_items}}\n**Participants:** {{payload.participants}}\n**Meeting Context:** {{payload.title}}\n**Deal Information:** {{deal.value || "Unknown"}} deal at {{deal.stage || "Unknown"}} stage\n\n**Smart Assignment Rules:**\n1. **Role Detection** - Identify participant roles from email domains and context\n2. **Technical Tasks** → Assign to engineers/technical team members\n3. **Pricing/Commercial** → Assign to deal owner/sales rep\n4. **Legal/Contracts** → Assign to appropriate legal contact\n5. **Follow-up Calls** → Assign to meeting organizer or sales rep\n6. **Administrative** → Assign to most appropriate support role\n\n**For each action item provide:**\n{\n  "title": "Clear, actionable task title",\n  "description": "Detailed task description",\n  "assignee_email": "best@match.com (from participants)",\n  "assignee_reasoning": "Why this person was chosen",\n  "priority": "urgent|high|medium|low",\n  "category": "Technical|Commercial|Administrative|Follow-up|Legal|Review",\n  "due_date_days": 1-7,\n  "sla_required": true|false,\n  "dependencies": ["other task dependencies"],\n  "coaching_note": "If this relates to sales coaching insights"\n}\n\nReturn as JSON array of action items with smart role-based assignments.',
            'priorityMapping', jsonb_build_object(
              'urgent', 'eeb122d5-d850-4381-b914-2ad09e48421b',
              'high', '42641fa1-9e6c-48fd-8c08-ada611ccc92a',
              'medium', 'e6153e53-d1c7-431a-afde-cd7c21b02ebb',
              'low', '1c00bc94-5358-4348-aaf3-cb2baa4747c4'
            ),
            'userMapping', jsonb_build_object(
              'Andrew Bryce', 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
              'Steve Gibson', 'e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f'
            ),
            'roleDetectionRules', jsonb_build_object(
              'technical_domains', jsonb_build_array('@engineering.com', '@dev.', '@tech.'),
              'sales_domains', jsonb_build_array('@sales.', '@business.', '@revenue.'),
              'legal_domains', jsonb_build_array('@legal.', '@contracts.', '@compliance.'),
              'admin_domains', jsonb_build_array('@admin.', '@ops.', '@support.')
            ),
            'categoryOptions', jsonb_build_array('Technical', 'Commercial', 'Administrative', 'Follow-up', 'Legal', 'Review', 'Coaching'),
            'calculateDeadlines', true,
            'accountForWeekends', true,
            'slaBasedDeadlines', true,
            'defaultDeadlineDays', 3,
            'urgentDeadlineDays', 1,
            'followUpDeadlineDays', 7
          )
        )
      ),
      
      -- 5. CREATE TASKS NODE
      jsonb_build_object(
        'id', 'create-tasks',
        'type', 'action',
        'position', jsonb_build_object('x', 850, 'y', 300),
        'data', jsonb_build_object(
          'label', 'Create Tasks',
          'icon', 'CheckSquare',
          'action', 'create_task_batch',
          'description', 'Create tasks from processed action items',
          'config', jsonb_build_object(
            'taskTemplate', jsonb_build_object(
              'title', '{{actionItem.title}}',
              'description', '{{actionItem.description}}\n\nFrom meeting: {{payload.title}}\nAssigned by AI based on: {{actionItem.reasoning}}',
              'user_id', '{{actionItem.assignee_id}}',
              'priority_id', '{{actionItem.priority_id}}',
              'due_date', '{{actionItem.deadline}}',
              'tags', '{{actionItem.tags}}',
              'meeting_id', '{{meeting.id}}',
              'fathom_recording_id', '{{payload.fathom_id}}'
            ),
            'batchMode', true,
            'notifyAssignee', true
          )
        )
      ),
      
      -- TRANSCRIPT ANALYSIS BRANCH  
      -- 6. AI AGENT NODE (for sales coaching analysis)
      jsonb_build_object(
        'id', 'ai-summary-analyzer',
        'type', 'aiAgent',
        'position', jsonb_build_object('x', 850, 'y', 100),
        'data', jsonb_build_object(
          'label', 'Sales Coaching AI',
          'aiProvider', 'openai',
          'model', 'gpt-4',
          'isConfigured', true,
          'systemPrompt', 'You are an expert B2B sales coach analyzing meeting transcripts to provide actionable coaching insights. Your analysis helps sales teams improve performance and close more deals.\n\nFocus areas:\n- Talk time ratio (ideal: customer 60-70%, rep 30-40%)\n- Discovery question quality and effectiveness\n- Objection handling techniques\n- Closing attempts and effectiveness\n- Next steps clarity and ownership\n- Buyer engagement signals\n- Risk factor identification\n- Deal progression likelihood\n\nProvide structured, measurable coaching insights that drive improvement.',
          'userPrompt', 'Analyze this sales meeting transcript for coaching opportunities:\n\n**Transcript:** {{googleDoc.content || payload.transcript}}\n**Participants:** {{payload.participants}}\n**Duration:** {{payload.duration}} minutes\n**Deal Stage:** {{deal.stage || "Unknown"}}\n**Meeting Type:** {{payload.title}}\n\n**Required Analysis:**\nProvide your coaching analysis as structured JSON:\n\n{\n  "talk_time_analysis": {\n    "customer_percentage": 0,\n    "rep_percentage": 0,\n    "coaching_note": "Assessment of talk time ratio and recommendations"\n  },\n  "discovery_score": {\n    "score": 0,\n    "strengths": ["effective discovery techniques used"],\n    "improvements": ["specific areas to improve questioning"]\n  },\n  "objection_handling": {\n    "score": 0,\n    "objections_raised": ["objection 1", "objection 2"],\n    "handling_effectiveness": "Assessment of how objections were addressed",\n    "missed_opportunities": ["areas where objections could have been better handled"]\n  },\n  "engagement_level": {\n    "score": 0,\n    "positive_signals": ["signs of customer interest and engagement"],\n    "concerning_signals": ["red flags or disengagement indicators"]\n  },\n  "opportunity_score": 0,\n  "buying_signals": ["explicit or implicit buying interest shown"],\n  "risk_factors": ["concerns that could derail the deal"],\n  "next_steps_clarity": {\n    "score": 0,\n    "defined_next_steps": ["specific next steps with owners"],\n    "missing_elements": ["what should have been clarified"]\n  },\n  "coaching_priorities": ["top 3 coaching areas for this rep"],\n  "manager_review_needed": false,\n  "stage_progression_recommendation": "advance|maintain|regress",\n  "follow_up_suggestions": ["specific recommended follow-up actions"]\n}',
          'temperature', 0.3,
          'maxTokens', 2000,
          'outputFormat', 'structured_json',
          'config', jsonb_build_object(
            'extractKeyPoints', true,
            'identifyRisks', true,
            'suggestFollowUps', true,
            'generateTags', true,
            'sentimentAnalysis', true,
            'coachingFocus', true,
            'dealScoring', true
          )
        )
      ),
      
      -- CRM INTEGRATION NODES (PHASE 3)
      -- 7. DEAL CREATION/UPDATE NODE
      jsonb_build_object(
        'id', 'create-update-deal',
        'type', 'action',
        'position', jsonb_build_object('x', 1100, 'y', 200),
        'data', jsonb_build_object(
          'label', 'Create/Update Deal',
          'icon', 'TrendingUp',
          'action', 'create_or_update_deal',
          'description', 'Auto-create/update deal from meeting insights',
          'config', jsonb_build_object(
            'scoreThreshold', 60,
            'autoCreateEnabled', true,
            'updateExisting', true,
            'dealName', '{{payload.title}} - {{payload.date}}',
            'dealValue', '{{aiAnalysis.coaching.opportunity_score * 1000}}',
            'dealCompany', '{{payload.participants[0].company}}',
            'dealStage', 'SQL',
            'dealProbability', '{{aiAnalysis.coaching.opportunity_score}}',
            'upsertKey', 'meeting_id',
            'progressionRules', jsonb_build_object(
              'sql_to_opportunity', 60,
              'opportunity_to_verbal', 75,
              'verbal_to_signed', 85
            )
          )
        )
      ),

      -- 8. MEETING UPSERT NODE (enhanced with contact linking)
      jsonb_build_object(
        'id', 'upsert-meeting',
        'type', 'meetingUpsert',
        'position', jsonb_build_object('x', 1100, 'y', 400),
        'data', jsonb_build_object(
          'label', 'Update Meeting + Link Contacts',
          'upsertKey', 'fathom_recording_id',
          'isConfigured', true,
          'mappings', jsonb_build_object(
            'title', '{{payload.title}}',
            'fathom_recording_id', '{{payload.fathom_id}}',
            'share_url', '{{payload.share_url}}',
            'video_url', '{{payload.video_url}}',
            'meeting_date', '{{payload.date}}',
            'duration_minutes', '{{payload.duration}}',
            'participants', '{{payload.participants}}',
            'organizer', '{{payload.organizer}}',
            'transcript', '{{payload.transcript}}',
            'transcript_doc_url', '{{googleDoc.url}}',
            'transcript_doc_id', '{{googleDoc.id}}',
            'summary', '{{payload.summary}}',
            'ai_analysis', '{{aiAnalysis.output}}',
            'sales_coaching_data', '{{aiAnalysis.coaching}}',
            'talk_time_ratio', '{{aiAnalysis.coaching.talk_time_analysis}}',
            'discovery_score', '{{aiAnalysis.coaching.discovery_score.score}}',
            'objection_handling_score', '{{aiAnalysis.coaching.objection_handling.score}}',
            'engagement_score', '{{aiAnalysis.coaching.engagement_level.score}}',
            'opportunity_score', '{{aiAnalysis.coaching.opportunity_score}}',
            'coaching_priorities', '{{aiAnalysis.coaching.coaching_priorities}}',
            'manager_review_needed', '{{aiAnalysis.coaching.manager_review_needed}}',
            'stage_progression_rec', '{{aiAnalysis.coaching.stage_progression_recommendation}}',
            'buying_signals', '{{aiAnalysis.coaching.buying_signals}}',
            'risk_factors', '{{aiAnalysis.coaching.risk_factors}}',
            'key_decisions', '{{aiAnalysis.decisions}}',
            'action_items', '{{processedActions.items}}',
            'action_items_count', '{{processedActions.count}}',
            'smart_assignments', '{{processedActions.smart_assignments}}',
            'tasks_created', '{{createdTasks.ids}}',
            'deal_created_id', '{{deal.id}}',
            'contacts_enriched', '{{contacts.enriched_count}}',
            'companies_created', '{{companies.created_count}}',
            'tags', '{{aiAnalysis.tags}}',
            'processed_at', '{{now}}',
            'workflow_version', '3.0'
          ),
          'config', jsonb_build_object(
            'createIfNotExists', true,
            'updateExisting', true,
            'mergeArrays', true,
            'timestampFields', true,
            'auditLog', true,
            'linkContacts', true,
            'enrichContacts', true,
            'createCompanies', true,
            'updateEngagement', true
          )
        )
      ),
      
      -- 9. ENHANCED NOTIFICATION NODE (final step with CRM routing)
      jsonb_build_object(
        'id', 'send-notifications',
        'type', 'action',
        'position', jsonb_build_object('x', 1350, 'y', 400),
        'data', jsonb_build_object(
          'label', 'CRM-Driven Notifications',
          'icon', 'Bell',
          'action', 'multi_channel_notify',
          'description', 'Smart notifications with CRM integration',
          'config', jsonb_build_object(
            'channels', jsonb_build_array('slack', 'email'),
            'enhancedRouting', true,
            'slackConfig', jsonb_build_object(
              'channel', '#meetings',
              'message', ':white_check_mark: Meeting "{{payload.title}}" processed with CRM integration\n\n:memo: Summary: {{payload.summary|truncate:150}}\n:clipboard: Action Items: {{processedActions.count}} (smart assigned)\n:chart_with_upwards_trend: Opportunity Score: {{aiAnalysis.coaching.opportunity_score}}/100\n:money_with_wings: Deal Created: ${{deal.value}} ({{deal.stage}})\n:busts_in_silhouette: Contacts Enriched: {{contacts.enriched_count}}\n:office: Companies Created: {{companies.created_count}}\n:speaking_head_in_silhouette: Talk Ratio: {{aiAnalysis.coaching.talk_time_analysis.rep_percentage}}% rep / {{aiAnalysis.coaching.talk_time_analysis.customer_percentage}}% customer\n{{#if aiAnalysis.coaching.manager_review_needed}}:warning: Manager review required{{/if}}\n{{#if deal.value > 50000}}:rotating_light: High-value deal alert{{/if}}\n:link: <{{googleDoc.url}}|View Transcript>\n:video_camera: <{{payload.share_url}}|Watch Recording>',
              'unfurlLinks', false,
              'threadTs', '{{slack.thread_ts}}'
            ),
            'emailConfig', jsonb_build_object(
              'to', '{{payload.participants}}',
              'subject', 'Meeting Processed with CRM Update: {{payload.title}}',
              'template', 'meeting_processed_crm',
              'variables', jsonb_build_object(
                'meetingTitle', '{{payload.title}}',
                'transcriptUrl', '{{googleDoc.url}}',
                'actionItemsCount', '{{processedActions.count}}',
                'recordingUrl', '{{payload.share_url}}',
                'dealCreated', '{{deal.id}}',
                'opportunityScore', '{{aiAnalysis.coaching.opportunity_score}}',
                'contactsEnriched', '{{contacts.enriched_count}}'
              )
            ),
            'conditionalSend', true,
            'conditions', jsonb_build_array(
              jsonb_build_object('if', 'processedActions.count > 0', 'notify', 'action_owners'),
              jsonb_build_object('if', 'aiAnalysis.coaching.opportunity_score > 75', 'notify', 'sales_team managers'),
              jsonb_build_object('if', 'aiAnalysis.coaching.opportunity_score >= 40 AND aiAnalysis.coaching.opportunity_score <= 75', 'notify', 'deal_owners'),
              jsonb_build_object('if', 'aiAnalysis.coaching.opportunity_score < 40', 'notify', 'sales_managers'),
              jsonb_build_object('if', 'aiAnalysis.coaching.manager_review_needed == true', 'notify', 'sales_managers'),
              jsonb_build_object('if', 'aiAnalysis.coaching.risk_factors.length > 2', 'notify', 'senior_sales_team'),
              jsonb_build_object('if', 'deal.value > 50000', 'notify', 'executive_team'),
              jsonb_build_object('if', 'contacts.enriched_count > 0', 'notify', 'sales_ops'),
              jsonb_build_object('if', 'deal.created == true', 'notify', 'sales_managers deal_owners')
            )
          )
        )
      )
    ),
    
    'edges', jsonb_build_array(
      -- Main flow
      jsonb_build_object(
        'id', 'e1',
        'source', 'fathom-webhook-trigger',
        'target', 'payload-router',
        'sourceHandle', 'payload',
        'targetHandle', null,
        'type', 'smoothstep',
        'animated', true,
        'label', 'Payload'
      ),
      
      -- Transcript branch
      jsonb_build_object(
        'id', 'e2',
        'source', 'payload-router',
        'sourceHandle', 'transcript',
        'target', 'create-transcript-doc',
        'targetHandle', null,
        'type', 'smoothstep',
        'animated', true,
        'style', jsonb_build_object('stroke', '#10b981'),
        'label', 'Has Transcript'
      ),
      jsonb_build_object(
        'id', 'e3',
        'source', 'create-transcript-doc',
        'target', 'ai-summary-analyzer',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Transcript for Coaching'
      ),
      
      -- Action items branch
      jsonb_build_object(
        'id', 'e4',
        'source', 'payload-router',
        'sourceHandle', 'action_items',
        'target', 'process-actions',
        'targetHandle', null,
        'type', 'smoothstep',
        'animated', true,
        'style', jsonb_build_object('stroke', '#f59e0b'),
        'label', 'Has Actions'
      ),
      jsonb_build_object(
        'id', 'e5',
        'source', 'process-actions',
        'target', 'create-tasks',
        'type', 'smoothstep',
        'animated', true
      ),
      jsonb_build_object(
        'id', 'e6',
        'source', 'create-tasks',
        'target', 'upsert-meeting',
        'type', 'smoothstep',
        'animated', true
      ),
      
      -- Coaching Analysis branch  
      jsonb_build_object(
        'id', 'e8',
        'source', 'ai-summary-analyzer',
        'target', 'create-update-deal',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Sales Coaching Data'
      ),
      
      -- CRM Integration flow
      jsonb_build_object(
        'id', 'e9',
        'source', 'create-update-deal',
        'target', 'upsert-meeting',
        'type', 'smoothstep',
        'animated', true,
        'label', 'Deal Created'
      ),
      
      -- Final step
      jsonb_build_object(
        'id', 'e10',
        'source', 'upsert-meeting',
        'target', 'send-notifications',
        'type', 'smoothstep',
        'animated', true,
        'label', 'CRM Integrated'
      )
    )
  ),
  rule_description = 'Phase 3 Fathom integration with complete CRM integration: FathomWebhook trigger, ConditionalBranch routing, GoogleDocsCreator for transcripts, Smart ActionItemProcessor with role-based assignment, Enhanced AIAgent for comprehensive sales coaching analysis (talk time, discovery, objections, opportunity scoring), AI-driven Deal Creation/Update with automatic pipeline progression based on opportunity scores, Enhanced MeetingUpsert with contact linking and company enrichment, and CRM-driven multi-channel notifications with conditional routing based on deal values and coaching insights.',
  updated_at = NOW()
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
    id,
    rule_name,
    rule_description,
    jsonb_array_length(canvas_data->'nodes') as node_count,
    jsonb_array_length(canvas_data->'edges') as edge_count,
    canvas_data->'nodes'->0->>'type' as first_node_type,
    canvas_data->'nodes'->1->>'type' as second_node_type
FROM user_automation_rules
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';