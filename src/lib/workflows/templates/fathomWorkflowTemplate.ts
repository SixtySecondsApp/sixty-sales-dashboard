import { Node, Edge } from 'reactflow';

export const fathomWorkflowTemplate = {
  id: 'fathom-meeting-workflow',
  name: 'Fathom Meeting Integration',
  description: 'Comprehensive workflow for processing Fathom meeting webhooks including transcripts, summaries, and action items',
  category: 'meetings',
  tags: ['fathom', 'meetings', 'transcripts', 'action-items', 'ai', 'automation'],
  nodes: [
    {
      id: 'webhook-trigger',
      type: 'fathomWebhook',
      position: { x: 100, y: 200 },  // Aligned with branch node
      data: {
        label: 'Fathom Webhook',
        isConfigured: true,
        webhookUrl: '/api/workflow-webhook/',
        acceptedPayloads: ['summary', 'transcript', 'action_items'],
        config: {
          autoDetectPayload: true,
          extractFathomId: true,
          validatePayload: true
        }
      }
    },
    {
      id: 'payload-router',
      type: 'conditionalBranch',
      position: { x: 350, y: 200 },  // Aligned with webhook node
      data: {
        label: 'Route by Payload Type',
        isConfigured: true,
        condition: 'payload_type',
        branches: [
          { id: 'transcript', label: 'Transcript', condition: 'payload.topic === "transcript" || payload.transcript' },
          { id: 'summary', label: 'Summary', condition: 'payload.topic === "summary" || payload.ai_summary' },
          { id: 'action_items', label: 'Action Items', condition: 'payload.topic === "action_items" || payload.action_item' }
        ]
      }
    },
    // Summary Branch (middle position - branch 2)
    {
      id: 'summary-processor',
      type: 'meetingUpsert',
      position: { x: 600, y: 200 },
      data: {
        label: 'Process Summary',
        table: 'meetings',
        upsertKey: 'fathom_recording_id',
        isConfigured: true,
        config: {
          handleAttendees: true,
          storeEmbedUrl: true,
          processMetrics: true,
          aiTrainingMetadata: true
        },
        fields: [
          'title',
          'share_url',
          'calls_url',
          'meeting_start',
          'meeting_end',
          'duration_minutes',
          'owner_user_id',
          'owner_email',
          'team_name',
          'summary',
          'fathom_embed_url',
          'ai_training_metadata'
        ]
      }
    },
    // Transcript Branch (top position - branch 1)
    {
      id: 'transcript-to-docs',
      type: 'googleDocsCreator',
      position: { x: 600, y: 100 },
      data: {
        label: 'Create Google Doc',
        isConfigured: true,
        docTitle: '{meeting.title} - Transcript',
        config: {
          formatTranscript: true,
          addTimestamps: true,
          shareWithAI: true,
          vectorDbReady: true
        },
        permissions: ['ai-assistant@sixtyseconds.video']
      }
    },
    // AI Agent for Sales Coaching Analysis
    {
      id: 'ai-summary-analyzer',
      type: 'aiAgent',
      position: { x: 850, y: 100 },
      data: {
        label: 'Sales Coaching AI',
        isConfigured: true,
        aiProvider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        systemPrompt: `You are a sales coaching AI analyzing meeting transcripts to provide actionable insights.

Focus on:
1. Sales conversation effectiveness (discovery, objection handling, next steps)
2. Talk time ratio (aim for 40% salesperson, 60% prospect)
3. Deal scoring (0-100 based on engagement and buying signals)
4. Risk factors and opportunities
5. Specific coaching recommendations`,
        userPrompt: `Analyze this sales meeting transcript for coaching opportunities:

**Transcript:** {{googleDoc.content || payload.transcript}}
**Participants:** {{payload.participants}}
**Duration:** {{payload.duration}} minutes
**Deal Stage:** {{deal.stage || "Unknown"}}

Provide a structured JSON response with:
{
  "coaching": {
    "talk_time_ratio": "percentage salesperson talked",
    "discovery_score": 0-100,
    "objection_handling": "rating and specific examples",
    "next_steps_clarity": "clear/unclear with details",
    "opportunity_score": 0-100,
    "risk_factors": ["list of concerns"],
    "recommendations": ["specific coaching points"]
  },
  "deal_insights": {
    "should_create_deal": true/false,
    "suggested_value": number,
    "probability": percentage,
    "key_stakeholders": ["names and roles"],
    "next_actions": ["specific follow-ups needed"]
  },
  "summary": "2-3 sentence executive summary"
}`,
        config: {
          retryOnError: true,
          maxRetries: 3,
          timeout: 30000,
          cacheResults: false,
          includeContext: true
        }
      }
    },
    {
      id: 'transcript-db-update',
      type: 'meetingUpsert',
      position: { x: 1100, y: 100 },
      data: {
        label: 'Update Meeting Record',
        table: 'meetings',
        upsertKey: 'fathom_recording_id',
        isConfigured: true,
        config: {
          updateOnly: true
        },
        fields: ['transcript_doc_url']
      }
    },
    // Action Items Branch
    {
      id: 'action-item-processor',
      type: 'actionItemProcessor',
      position: { x: 600, y: 300 },
      data: {
        label: 'Process Action Item',
        isConfigured: true,
        config: {
          aiEnabled: true,
          priorityMapping: {
            urgent: 'eeb122d5-d850-4381-b914-2ad09e48421b',
            high: '42641fa1-9e6c-48fd-8c08-ada611ccc92a',
            medium: 'e6153e53-d1c7-431a-afde-cd7c21b02ebb',
            low: '1c00bc94-5358-4348-aaf3-cb2baa4747c4'
          },
          userMapping: {
            'Andrew Bryce': '053aab56-8fc6-4fe1-9cbe-702092b7780b',
            'Steve Gibson': 'e6380a9c-f0cf-46ad-96c3-73b1d1d48c9f',
            'andrew.bryce@sixtyseconds.video': '053aab56-8fc6-4fe1-9cbe-702092b7780b'
          },
          categoryOptions: [
            'Call',
            'Email',
            'Whatsapp / Text',
            'LinkedIn Message',
            'LinkedIn Connection',
            'Proposal',
            'Send Information'
          ],
          calculateDeadlines: true,
          accountForWeekends: true,
          defaultDeadlineDays: 3
        }
      }
    },
    {
      id: 'action-item-save',
      type: 'databaseNode',
      position: { x: 850, y: 300 },
      data: {
        label: 'Save Action Item',
        table: 'meeting_action_items',
        operation: 'insert',
        isConfigured: true,
        fields: [
          'meeting_id',
          'title',
          'assignee_name',
          'assignee_email',
          'priority',
          'category',
          'deadline_at',
          'completed',
          'ai_generated',
          'timestamp_seconds',
          'playback_url'
        ]
      }
    },
    {
      id: 'create-task',
      type: 'taskCreator',
      position: { x: 1100, y: 300 },
      data: {
        label: 'Create Follow-up Task',
        isConfigured: true,
        config: {
          createWhen: 'always',
          taskTemplate: {
            title: '{action_item.title}',
            priority_id: '{action_item.priority_id}',
            user_id: '{action_item.user_id}',
            category: '{action_item.category}',
            due_date: '{action_item.deadline}',
            meeting_id: '{meeting.id}'
          }
        }
      }
    }
  ] as Node[],
  edges: [
    {
      id: 'webhook-to-router',
      source: 'webhook-trigger',
      target: 'payload-router',
      type: 'default'
      // No label - clean connection
    },
    {
      id: 'router-to-transcript',
      source: 'payload-router',
      sourceHandle: 'transcript',
      target: 'transcript-to-docs',
      type: 'default',
      animated: true
    },
    {
      id: 'router-to-summary',
      source: 'payload-router',
      sourceHandle: 'summary',
      target: 'summary-processor',
      type: 'default',
      animated: true
    },
    {
      id: 'docs-to-ai',
      source: 'transcript-to-docs',
      target: 'ai-summary-analyzer',
      type: 'default',
      data: {
        label: 'Meeting Transcript',
        labelBgColor: '#3b82f6',
        labelTextColor: '#ffffff'
      }
    },
    {
      id: 'ai-to-update',
      source: 'ai-summary-analyzer',
      target: 'transcript-db-update',
      type: 'default',
      data: {
        label: 'AI Analysis',
        labelBgColor: '#7c3aed',
        labelTextColor: '#ffffff'
      }
    },
    {
      id: 'router-to-action',
      source: 'payload-router',
      sourceHandle: 'action_items',
      target: 'action-item-processor',
      type: 'default',
      animated: true
    },
    {
      id: 'action-to-save',
      source: 'action-item-processor',
      target: 'action-item-save',
      type: 'default'
    },
    {
      id: 'save-to-task',
      source: 'action-item-save',
      target: 'create-task',
      type: 'default'
    }
  ] as Edge[],
  variables: {
    fathomApiKey: '',
    googleServiceAccount: '',
    supabaseUrl: typeof window !== 'undefined' && (import.meta?.env?.VITE_SUPABASE_URL || import.meta?.env?.SUPABASE_URL) || '',
    supabaseKey: typeof window !== 'undefined' && (import.meta?.env?.VITE_SUPABASE_ANON_KEY || import.meta?.env?.SUPABASE_ANON_KEY) || ''
  },
  requiredIntegrations: ['fathom', 'google-docs', 'supabase'],
  estimatedExecutionTime: '2-5 seconds',
  version: '1.0.0'
};

// Export function to get a fresh copy of the template
export function getFathomWorkflowTemplate() {
  return JSON.parse(JSON.stringify(fathomWorkflowTemplate));
}

// Export function to validate if all required fields are configured
export function validateFathomWorkflow(workflow: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check webhook configuration
  const webhookNode = workflow.nodes?.find((n: any) => n.type === 'fathomWebhook');
  if (!webhookNode) {
    errors.push('Missing Fathom webhook trigger node');
  }

  // Check conditional branch
  const branchNode = workflow.nodes?.find((n: any) => n.type === 'conditionalBranch');
  if (!branchNode) {
    errors.push('Missing conditional branch node for payload routing');
  }

  // Check Google Docs creator
  const docsNode = workflow.nodes?.find((n: any) => n.type === 'googleDocsCreator');
  if (!docsNode) {
    errors.push('Missing Google Docs creator node for transcripts');
  }

  // Check action item processor
  const actionNode = workflow.nodes?.find((n: any) => n.type === 'actionItemProcessor');
  if (!actionNode) {
    errors.push('Missing action item processor node');
  } else if (!actionNode.data?.config?.priorityMapping) {
    errors.push('Action item processor missing priority UUID mapping');
  }

  // Check database nodes
  const dbNodes = workflow.nodes?.filter((n: any) => 
    n.type === 'meetingUpsert' || n.type === 'databaseNode'
  );
  if (dbNodes.length < 3) {
    errors.push('Missing required database operation nodes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}