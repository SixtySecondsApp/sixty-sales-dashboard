-- Complete Fathom Workflow Redesign with Custom Node Types
-- Workflow ID: c914a0af-7cd4-43b8-97f2-863e6a4abf9f

UPDATE workflows 
SET workflow_data = '{
  "nodes": [
    {
      "id": "fathom-webhook-1",
      "type": "fathomWebhook",
      "position": { "x": 100, "y": 250 },
      "data": {
        "label": "Fathom Webhook Trigger",
        "description": "Receives webhooks from Fathom with meeting data",
        "config": {
          "webhookUrl": "/api/webhook/fathom",
          "acceptedPayloadTypes": ["transcript", "action_items", "summary"],
          "authRequired": true,
          "outputVariable": "fathomPayload",
          "expectedFields": {
            "title": "string",
            "transcript": "string", 
            "action_items": "array",
            "summary": "string",
            "meeting_id": "string",
            "participants": "array",
            "duration": "number",
            "start_time": "datetime",
            "end_time": "datetime"
          }
        }
      },
      "outputs": [
        {
          "id": "webhook-output",
          "type": "webhook",
          "label": "Webhook Data"
        }
      ]
    },
    {
      "id": "conditional-branch-1", 
      "type": "conditionalBranch",
      "position": { "x": 350, "y": 250 },
      "data": {
        "label": "Content Type Router",
        "description": "Routes based on payload content type",
        "config": {
          "conditions": [
            {
              "id": "transcript-condition",
              "expression": "{{fathomPayload.transcript}} && {{fathomPayload.transcript.length}} > 0",
              "outputHandle": "transcript-branch"
            },
            {
              "id": "action-items-condition", 
              "expression": "{{fathomPayload.action_items}} && {{fathomPayload.action_items.length}} > 0",
              "outputHandle": "action-items-branch"
            },
            {
              "id": "summary-condition",
              "expression": "{{fathomPayload.summary}} && {{fathomPayload.summary.length}} > 0", 
              "outputHandle": "summary-branch"
            }
          ],
          "evaluationMode": "parallel",
          "defaultBranch": "all-branches"
        }
      },
      "inputs": [
        {
          "id": "branch-input",
          "type": "webhook",
          "label": "Webhook Data"
        }
      ],
      "outputs": [
        {
          "id": "transcript-branch",
          "type": "conditional",
          "label": "Has Transcript"
        },
        {
          "id": "action-items-branch", 
          "type": "conditional",
          "label": "Has Action Items"
        },
        {
          "id": "summary-branch",
          "type": "conditional", 
          "label": "Has Summary"
        }
      ]
    },
    {
      "id": "google-docs-creator-1",
      "type": "googleDocsCreator",
      "position": { "x": 600, "y": 100 },
      "data": {
        "label": "Create Transcript Document",
        "description": "Creates Google Doc with meeting transcript",
        "config": {
          "title": "Meeting Transcript - {{fathomPayload.title}}",
          "content": "# Meeting Transcript\\n\\n**Meeting:** {{fathomPayload.title}}\\n**Date:** {{fathomPayload.start_time | formatDate}}\\n**Duration:** {{fathomPayload.duration}} minutes\\n**Participants:** {{fathomPayload.participants | join(\", \")}}\\n\\n## Transcript\\n\\n{{fathomPayload.transcript}}",
          "folderId": "{{settings.googleDrive.transcriptFolderId}}",
          "shareSettings": {
            "type": "anyone",
            "role": "reader"
          },
          "outputVariable": "transcriptDoc"
        }
      },
      "inputs": [
        {
          "id": "transcript-input",
          "type": "conditional",
          "label": "Transcript Data"
        }
      ],
      "outputs": [
        {
          "id": "doc-created",
          "type": "document",
          "label": "Document Created"
        }
      ]
    },
    {
      "id": "action-item-processor-1",
      "type": "actionItemProcessor", 
      "position": { "x": 600, "y": 300 },
      "data": {
        "label": "Process Action Items",
        "description": "AI-powered action item classification and processing",
        "config": {
          "aiEnabled": true,
          "aiModel": "gpt-4",
          "prompt": "Analyze the following action items and classify each one. For each action item, determine:\\n1. Priority (High, Medium, Low)\\n2. Assignee (if mentioned)\\n3. Due date (if mentioned or suggest reasonable timeline)\\n4. Category (Task, Follow-up, Research, Decision, etc.)\\n5. Estimated effort (Small, Medium, Large)\\n\\nAction Items: {{fathomPayload.action_items | json}}\\n\\nReturn structured JSON with classified action items.",
          "outputFormat": "structured",
          "processingRules": {
            "autoAssign": true,
            "defaultPriority": "Medium",
            "defaultDueDate": "+3 days",
            "createTasks": true
          },
          "outputVariable": "processedActionItems"
        }
      },
      "inputs": [
        {
          "id": "action-items-input",
          "type": "conditional", 
          "label": "Action Items Data"
        }
      ],
      "outputs": [
        {
          "id": "items-processed",
          "type": "actionItems",
          "label": "Processed Items"
        }
      ]
    },
    {
      "id": "ai-agent-summary-1",
      "type": "aiAgent",
      "position": { "x": 600, "y": 500 },
      "data": {
        "label": "AI Summary Classification",
        "description": "AI agent for meeting summary analysis and classification",
        "config": {
          "aiModel": "gpt-4",
          "systemPrompt": "You are an expert meeting analyst. Your job is to analyze meeting summaries and extract key insights.",
          "userPrompt": "Please analyze this meeting summary and extract:\\n\\n1. **Key Decisions Made**: List any decisions reached\\n2. **Next Steps**: Identify follow-up actions\\n3. **Meeting Type**: Classify as (Sales Call, Team Meeting, Client Review, Planning Session, etc.)\\n4. **Outcome**: Rate the meeting effectiveness (Productive, Partially Productive, Needs Follow-up)\\n5. **Key Topics**: List main discussion topics\\n6. **Risks/Blockers**: Identify any mentioned risks or blockers\\n\\nMeeting Summary: {{fathomPayload.summary}}\\n\\nReturn structured JSON with your analysis.",
          "temperature": 0.3,
          "maxTokens": 1000,
          "outputVariable": "summaryAnalysis",
          "responseFormat": "json"
        }
      },
      "inputs": [
        {
          "id": "summary-input",
          "type": "conditional",
          "label": "Summary Data"
        }
      ],
      "outputs": [
        {
          "id": "analysis-complete",
          "type": "analysis",
          "label": "Analysis Complete"
        }
      ]
    },
    {
      "id": "meeting-upsert-1",
      "type": "meetingUpsert",
      "position": { "x": 850, "y": 300 },
      "data": {
        "label": "Update Meeting Record",
        "description": "Creates or updates meeting record with all processed data",
        "config": {
          "operation": "upsert",
          "matchingField": "external_meeting_id",
          "fieldMappings": {
            "external_meeting_id": "{{fathomPayload.meeting_id}}",
            "title": "{{fathomPayload.title}}",
            "date": "{{fathomPayload.start_time | formatDate(\"YYYY-MM-DD\")}}",
            "start_time": "{{fathomPayload.start_time}}",
            "end_time": "{{fathomPayload.end_time}}",
            "duration_minutes": "{{fathomPayload.duration}}",
            "transcript": "{{fathomPayload.transcript}}",
            "summary": "{{fathomPayload.summary}}",
            "action_items": "{{fathomPayload.action_items | json}}",
            "processed_action_items": "{{processedActionItems | json}}",
            "ai_analysis": "{{summaryAnalysis | json}}",
            "transcript_doc_url": "{{transcriptDoc.webViewLink}}",
            "participants": "{{fathomPayload.participants | join(\", \")}}",
            "meeting_type": "{{summaryAnalysis.meetingType}}",
            "outcome": "{{summaryAnalysis.outcome}}",
            "key_decisions": "{{summaryAnalysis.keyDecisions | json}}",
            "next_steps": "{{summaryAnalysis.nextSteps | json}}",
            "topics": "{{summaryAnalysis.keyTopics | json}}",
            "risks_blockers": "{{summaryAnalysis.risksBlockers | json}}",
            "source": "fathom",
            "processed_at": "{{now()}}",
            "owner_user_id": "{{user.id}}"
          },
          "createTasks": {
            "enabled": true,
            "source": "processedActionItems",
            "taskMappings": {
              "title": "{{item.text}}",
              "description": "Action item from meeting: {{fathomPayload.title}}",
              "priority": "{{item.priority | lower}}",
              "due_date": "{{item.dueDate}}",
              "assignee": "{{item.assignee || user.id}}",
              "category": "{{item.category}}",
              "effort_estimate": "{{item.estimatedEffort}}",
              "source_meeting_id": "{{meetingRecord.id}}"
            }
          },
          "outputVariable": "meetingRecord"
        }
      },
      "inputs": [
        {
          "id": "transcript-result",
          "type": "document",
          "label": "Transcript Doc"
        },
        {
          "id": "action-items-result", 
          "type": "actionItems",
          "label": "Processed Action Items"
        },
        {
          "id": "summary-result",
          "type": "analysis", 
          "label": "Summary Analysis"
        }
      ],
      "outputs": [
        {
          "id": "meeting-saved",
          "type": "meeting",
          "label": "Meeting Saved"
        }
      ]
    }
  ],
  "edges": [
    {
      "id": "webhook-to-branch",
      "source": "fathom-webhook-1",
      "target": "conditional-branch-1",
      "sourceHandle": "webhook-output",
      "targetHandle": "branch-input"
    },
    {
      "id": "branch-to-transcript",
      "source": "conditional-branch-1", 
      "target": "google-docs-creator-1",
      "sourceHandle": "transcript-branch",
      "targetHandle": "transcript-input"
    },
    {
      "id": "branch-to-actions",
      "source": "conditional-branch-1",
      "target": "action-item-processor-1", 
      "sourceHandle": "action-items-branch",
      "targetHandle": "action-items-input"
    },
    {
      "id": "branch-to-summary",
      "source": "conditional-branch-1",
      "target": "ai-agent-summary-1",
      "sourceHandle": "summary-branch", 
      "targetHandle": "summary-input"
    },
    {
      "id": "transcript-to-meeting",
      "source": "google-docs-creator-1",
      "target": "meeting-upsert-1",
      "sourceHandle": "doc-created",
      "targetHandle": "transcript-result"
    },
    {
      "id": "actions-to-meeting",
      "source": "action-item-processor-1",
      "target": "meeting-upsert-1", 
      "sourceHandle": "items-processed",
      "targetHandle": "action-items-result"
    },
    {
      "id": "summary-to-meeting",
      "source": "ai-agent-summary-1",
      "target": "meeting-upsert-1",
      "sourceHandle": "analysis-complete",
      "targetHandle": "summary-result"
    }
  ],
  "settings": {
    "name": "Fathom Meeting Integration Workflow",
    "description": "Complete workflow for processing Fathom meeting webhooks with transcript creation, action item processing, and AI analysis",
    "version": "2.0",
    "triggers": ["webhook"],
    "webhookPath": "/api/webhook/fathom",
    "authentication": {
      "required": true,
      "type": "api_key"
    },
    "variables": {
      "fathomPayload": {
        "type": "object",
        "description": "Complete Fathom webhook payload"
      },
      "transcriptDoc": {
        "type": "object", 
        "description": "Created Google Doc information"
      },
      "processedActionItems": {
        "type": "array",
        "description": "AI-processed and classified action items"
      },
      "summaryAnalysis": {
        "type": "object",
        "description": "AI analysis of meeting summary"
      },
      "meetingRecord": {
        "type": "object",
        "description": "Final meeting database record"
      }
    },
    "errorHandling": {
      "retryAttempts": 3,
      "retryDelay": 5000,
      "onFailure": "log_and_notify"
    },
    "monitoring": {
      "enabled": true,
      "logLevel": "info",
      "trackPerformance": true
    }
  }
}'::jsonb
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Verify the update
SELECT 
  id,
  name,
  description,
  jsonb_pretty(workflow_data->'settings') as workflow_settings,
  jsonb_array_length(workflow_data->'nodes') as node_count,
  jsonb_array_length(workflow_data->'edges') as edge_count,
  is_active,
  updated_at
FROM workflows 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Show node types and positions
SELECT 
  jsonb_array_elements(workflow_data->'nodes')->>'id' as node_id,
  jsonb_array_elements(workflow_data->'nodes')->>'type' as node_type,
  jsonb_array_elements(workflow_data->'nodes')->'position' as position,
  jsonb_array_elements(workflow_data->'nodes')->'data'->>'label' as label
FROM workflows 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';

-- Show edge connections  
SELECT
  jsonb_array_elements(workflow_data->'edges')->>'id' as edge_id,
  jsonb_array_elements(workflow_data->'edges')->>'source' as source_node,
  jsonb_array_elements(workflow_data->'edges')->>'target' as target_node,
  jsonb_array_elements(workflow_data->'edges')->>'sourceHandle' as source_handle,
  jsonb_array_elements(workflow_data->'edges')->>'targetHandle' as target_handle
FROM workflows 
WHERE id = 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f';