import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BookOpen,
  Search,
  Filter,
  Star,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  Mail,
  CheckSquare,
  Bell,
  Target,
  Activity,
  ChevronRight,
  Sparkles,
  Database,
  GitBranch
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  canvas_data: any;
  trigger_type: string;
  trigger_conditions: any;
  action_type: string;
  action_config: any;
  difficulty_level: 'easy' | 'medium' | 'hard';
  estimated_setup_time: number;
  tags: string[];
  usage_count: number;
  rating_avg: number;
  rating_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// Icon mapping for templates
const iconMap: { [key: string]: any } = {
  Target,
  Activity,
  Database,
  GitBranch,
  CheckSquare,
  Bell,
  Mail,
  Users,
  DollarSign,
  TrendingUp
};

// Category colors for visual distinction
const categoryColors: { [key: string]: string } = {
  sales: 'bg-blue-600',
  productivity: 'bg-[#37bd7e]',
  'customer success': 'bg-indigo-600',
  marketing: 'bg-purple-600',
  general: 'bg-gray-600'
};

const categories = ['All', 'sales', 'productivity', 'customer success', 'marketing', 'general'];

interface TemplateLibraryProps {
  onSelectTemplate: (template: any) => void;
}

const getDefaultTemplates = (): Template[] => {
  return [
    // BASIC COMPLEXITY
    {
      id: '1',
      name: 'Instant Lead Welcome',
      description: 'Automatically create a welcome task when a new lead enters your pipeline. Never miss the critical first touch point.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 100}, data: {label: 'New Deal Created', type: 'deal_created', iconName: 'Database', description: 'When a new deal is added'}},
          {id: 'action_1', type: 'action', position: {x: 400, y: 100}, data: {label: 'Create Welcome Task', type: 'create_task', iconName: 'CheckSquare', description: 'Reach out within 1 hour'}}
        ],
        edges: [{id: 'e1', source: 'trigger_1', target: 'action_1'}]
      },
      trigger_type: 'deal_created',
      trigger_conditions: {},
      action_type: 'create_task',
      action_config: {task_title: '🎯 Welcome {{deal_name}} - First Contact', due_in_hours: 1, priority: 'high'},
      difficulty_level: 'easy',
      estimated_setup_time: 2,
      tags: ['sales', 'lead-management', 'quick-response'],
      usage_count: 95,
      rating_avg: 4.7,
      rating_count: 250,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Post-Meeting Action Items',
      description: 'Create follow-up tasks automatically after logging a meeting. Ensure consistent post-meeting execution.',
      category: 'productivity',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 100}, data: {label: 'Meeting Logged', type: 'activity_created', iconName: 'Activity'}},
          {id: 'action_1', type: 'action', position: {x: 400, y: 100}, data: {label: 'Create Follow-up Task', type: 'create_task', iconName: 'CheckSquare'}}
        ],
        edges: [{id: 'e1', source: 'trigger_1', target: 'action_1'}]
      },
      trigger_type: 'activity_created',
      trigger_conditions: {activity_type: 'meeting'},
      action_type: 'create_task',
      action_config: {task_title: '📧 Send Meeting Follow-up', due_in_days: 1, priority: 'high'},
      difficulty_level: 'easy',
      estimated_setup_time: 2,
      tags: ['productivity', 'meetings', 'follow-up'],
      usage_count: 92,
      rating_avg: 4.7,
      rating_count: 240,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      name: 'Deal Won Notification',
      description: 'Celebrate wins instantly! Send team notifications when deals are marked as won.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 100}, data: {label: 'Deal Won', type: 'stage_changed', iconName: 'Target'}},
          {id: 'action_1', type: 'action', position: {x: 400, y: 100}, data: {label: 'Celebrate Win', type: 'send_notification', iconName: 'Bell'}}
        ],
        edges: [{id: 'e1', source: 'trigger_1', target: 'action_1'}]
      },
      trigger_type: 'stage_changed',
      trigger_conditions: {stage: 'Signed'},
      action_type: 'send_notification',
      action_config: {message: '🎉 DEAL WON! {{deal_name}}', notify_team: true},
      difficulty_level: 'easy',
      estimated_setup_time: 1,
      tags: ['sales', 'notifications', 'celebrations'],
      usage_count: 88,
      rating_avg: 4.8,
      rating_count: 220,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '4',
      name: 'Stale Opportunity Alert',
      description: 'Get alerted when deals in Opportunity stage haven\'t been touched in 7 days.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 100}, data: {label: 'No Activity', type: 'no_activity', iconName: 'Clock'}},
          {id: 'action_1', type: 'action', position: {x: 400, y: 100}, data: {label: 'Create Revival Task', type: 'create_task', iconName: 'CheckSquare'}}
        ],
        edges: [{id: 'e1', source: 'trigger_1', target: 'action_1'}]
      },
      trigger_type: 'no_activity',
      trigger_conditions: {stage: 'Opportunity', days_inactive: 7},
      action_type: 'create_task',
      action_config: {task_title: '🔥 URGENT: Re-engage {{deal_name}}', priority: 'high'},
      difficulty_level: 'easy',
      estimated_setup_time: 2,
      tags: ['sales', 'pipeline-hygiene', 'follow-up'],
      usage_count: 90,
      rating_avg: 4.6,
      rating_count: 210,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    // INTERMEDIATE COMPLEXITY
    {
      id: '5',
      name: 'Smart Proposal Follow-up',
      description: 'Multi-touch follow-up sequence after sending proposals. Day 3, 7, and 14 touchpoints.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 150}, data: {label: 'Proposal Sent', type: 'activity_created', iconName: 'Mail'}},
          {id: 'condition_1', type: 'condition', position: {x: 300, y: 150}, data: {label: 'Check Value', condition: 'deal_value > 10000'}},
          {id: 'action_1', type: 'action', position: {x: 500, y: 100}, data: {label: 'Day 3 Follow-up', type: 'create_task', iconName: 'CheckSquare'}},
          {id: 'action_2', type: 'action', position: {x: 500, y: 200}, data: {label: 'Day 7 Follow-up', type: 'create_task', iconName: 'CheckSquare'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'condition_1', target: 'action_1'},
          {id: 'e3', source: 'condition_1', target: 'action_2'}
        ]
      },
      trigger_type: 'activity_created',
      trigger_conditions: {activity_type: 'proposal'},
      action_type: 'create_sequence',
      action_config: {sequence_steps: 3},
      difficulty_level: 'medium',
      estimated_setup_time: 5,
      tags: ['sales', 'proposals', 'sequences'],
      usage_count: 93,
      rating_avg: 4.5,
      rating_count: 180,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '6',
      name: 'Lead Scoring & Routing',
      description: 'Score leads based on engagement and route high-value leads to senior reps.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 150}, data: {label: 'Activity Logged', type: 'activity_created', iconName: 'Activity'}},
          {id: 'condition_1', type: 'condition', position: {x: 300, y: 100}, data: {label: 'Email Opened', condition: 'activity_type = email_opened'}},
          {id: 'condition_2', type: 'condition', position: {x: 300, y: 200}, data: {label: 'Meeting Booked', condition: 'activity_type = meeting'}},
          {id: 'action_1', type: 'action', position: {x: 500, y: 100}, data: {label: 'Increase Score', type: 'update_field', iconName: 'TrendingUp'}},
          {id: 'action_2', type: 'action', position: {x: 500, y: 200}, data: {label: 'Assign Senior Rep', type: 'assign_owner', iconName: 'Users'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'trigger_1', target: 'condition_2'},
          {id: 'e3', source: 'condition_1', target: 'action_1'},
          {id: 'e4', source: 'condition_2', target: 'action_2'}
        ]
      },
      trigger_type: 'activity_created',
      trigger_conditions: {},
      action_type: 'update_field',
      action_config: {scoring_rules: true, routing_threshold: 50},
      difficulty_level: 'medium',
      estimated_setup_time: 7,
      tags: ['sales', 'lead-scoring', 'routing'],
      usage_count: 87,
      rating_avg: 4.4,
      rating_count: 160,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '7',
      name: 'Sales to Success Handoff',
      description: 'Smooth handoff from Sales to Customer Success when deals close.',
      category: 'customer success',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 150}, data: {label: 'Deal Won', type: 'stage_changed', iconName: 'Target'}},
          {id: 'action_1', type: 'action', position: {x: 350, y: 100}, data: {label: 'Notify CS Team', type: 'send_notification', iconName: 'Bell'}},
          {id: 'action_2', type: 'action', position: {x: 350, y: 200}, data: {label: 'Create Onboarding', type: 'create_task', iconName: 'CheckSquare'}},
          {id: 'action_3', type: 'action', position: {x: 350, y: 300}, data: {label: 'Schedule Kickoff', type: 'create_activity', iconName: 'Calendar'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'action_1'},
          {id: 'e2', source: 'trigger_1', target: 'action_2'},
          {id: 'e3', source: 'trigger_1', target: 'action_3'}
        ]
      },
      trigger_type: 'stage_changed',
      trigger_conditions: {stage: 'Signed'},
      action_type: 'create_multiple',
      action_config: {actions: 3},
      difficulty_level: 'medium',
      estimated_setup_time: 6,
      tags: ['customer-success', 'onboarding', 'handoff'],
      usage_count: 85,
      rating_avg: 4.5,
      rating_count: 150,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '8',
      name: 'Lost Deal Win-back',
      description: 'Automated re-engagement for lost deals after 90 days.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 100, y: 150}, data: {label: '90 Days Lost', type: 'time_based', iconName: 'Clock'}},
          {id: 'condition_1', type: 'condition', position: {x: 300, y: 150}, data: {label: 'Lost Reason', condition: 'lost_reason != competitor'}},
          {id: 'action_1', type: 'action', position: {x: 500, y: 100}, data: {label: 'Re-engage Email', type: 'create_task', iconName: 'Mail'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'condition_1', target: 'action_1'}
        ]
      },
      trigger_type: 'time_based',
      trigger_conditions: {days_since_lost: 90},
      action_type: 'create_task',
      action_config: {campaign_type: 'win_back'},
      difficulty_level: 'medium',
      estimated_setup_time: 8,
      tags: ['sales', 'win-back', 're-engagement'],
      usage_count: 82,
      rating_avg: 4.3,
      rating_count: 140,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    // NEW POWERFUL TEMPLATES WITH ADVANCED NODES
    {
      id: '9',
      name: '🚀 Deal Nurture Automation',
      description: 'Intelligent deal nurturing with recurring tasks, custom field tracking, and multi-channel engagement based on time since last contact.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {
            label: 'Activity Monitor', 
            type: 'activity_monitor', 
            iconName: 'Activity', 
            description: 'Monitor low activity',
            monitorType: 'low_activity',
            monitorDays: 5,
            activityThreshold: 2,
            monitoredActivityTypes: ['outbound', 'meeting', 'email']
          }},
          {id: 'condition_1', type: 'condition', position: {x: 250, y: 150}, data: {
            label: 'Check Priority', 
            conditionType: 'custom_field',
            customFieldName: 'priority',
            customFieldOperator: 'equals',
            customFieldValue: 'high',
            condition: 'Check if high priority'
          }},
          {id: 'condition_2', type: 'condition', position: {x: 250, y: 250}, data: {
            label: 'Time Since Contact', 
            conditionType: 'time_since_contact',
            timeComparison: 'greater_than',
            daysSinceContact: 7,
            condition: 'More than 7 days'
          }},
          {id: 'action_1', type: 'action', position: {x: 450, y: 100}, data: {
            label: 'Urgent Follow-up', 
            type: 'create_recurring_task',
            iconName: 'CheckSquare',
            taskTitle: '🔥 URGENT: Contact {{deal_name}}',
            recurrencePattern: 'daily',
            occurrences: 3
          }},
          {id: 'action_2', type: 'action', position: {x: 450, y: 200}, data: {
            label: 'Send to Slack', 
            type: 'send_slack',
            iconName: 'Slack',
            slackMessage: '⚠️ Deal needs attention: {{deal_name}} - {{value}}'
          }},
          {id: 'action_3', type: 'action', position: {x: 450, y: 300}, data: {
            label: 'Add Note', 
            type: 'add_note',
            iconName: 'FileText',
            noteContent: 'Automated follow-up triggered due to low activity. Last contact: {{days_since_contact}} days ago.',
            noteType: 'internal'
          }}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'trigger_1', target: 'condition_2'},
          {id: 'e3', source: 'condition_1', target: 'action_1'},
          {id: 'e4', source: 'condition_1', target: 'action_2'},
          {id: 'e5', source: 'condition_2', target: 'action_3'}
        ]
      },
      trigger_type: 'activity_monitor',
      trigger_conditions: {days: 5},
      action_type: 'multi_action',
      action_config: {actions: ['recurring_task', 'slack', 'note']},
      difficulty_level: 'hard',
      estimated_setup_time: 10,
      tags: ['sales', 'automation', 'engagement', 'slack', 'advanced'],
      usage_count: 0,
      rating_avg: 5.0,
      rating_count: 0,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '10',
      name: '📊 Customer Success Monitoring',
      description: 'Monitor customer health with task overdue alerts, batch field updates, and automated check-in scheduling.',
      category: 'customer success',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {
            label: 'Task Overdue', 
            type: 'task_overdue', 
            iconName: 'AlertTriangle',
            description: 'Monitor overdue tasks',
            checkFrequency: 'hourly'
          }},
          {id: 'condition_1', type: 'condition', position: {x: 250, y: 200}, data: {
            label: 'Customer Type',
            conditionType: 'custom_field',
            customFieldName: 'customer_tier',
            customFieldOperator: 'equals',
            customFieldValue: 'enterprise'
          }},
          {id: 'action_1', type: 'action', position: {x: 450, y: 100}, data: {
            label: 'Update Fields', 
            type: 'update_multiple_fields',
            iconName: 'TrendingUp',
            fieldUpdates: [
              {field: 'priority', value: 'urgent'},
              {field: 'health_score', value: 'at_risk'},
              {field: 'needs_attention', value: 'true'}
            ]
          }},
          {id: 'action_2', type: 'action', position: {x: 450, y: 200}, data: {
            label: 'Schedule Check-in', 
            type: 'create_recurring_task',
            iconName: 'CheckSquare',
            taskTitle: '📞 Customer health check: {{company}}',
            recurrencePattern: 'weekly',
            occurrences: 4
          }},
          {id: 'action_3', type: 'action', position: {x: 450, y: 300}, data: {
            label: 'Alert CSM', 
            type: 'send_notification',
            iconName: 'Bell',
            notificationTitle: 'Customer At Risk',
            notificationMessage: '{{company}} has overdue tasks and needs immediate attention'
          }}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'condition_1', target: 'action_1'},
          {id: 'e3', source: 'condition_1', target: 'action_2'},
          {id: 'e4', source: 'condition_1', target: 'action_3'}
        ]
      },
      trigger_type: 'task_overdue',
      trigger_conditions: {},
      action_type: 'multi_action',
      action_config: {actions: ['update_fields', 'recurring_task', 'notification']},
      difficulty_level: 'medium',
      estimated_setup_time: 8,
      tags: ['customer-success', 'monitoring', 'automation', 'health-score'],
      usage_count: 0,
      rating_avg: 5.0,
      rating_count: 0,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '11',
      name: '💬 Slack Deal Alert System',
      description: 'Real-time Slack notifications for deal movements with rich formatting, webhooks, and intelligent routing based on deal characteristics.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {
            label: 'Stage Changed', 
            type: 'stage_changed',
            iconName: 'Target',
            description: 'When deal moves stages'
          }},
          {id: 'condition_1', type: 'condition', position: {x: 200, y: 100}, data: {
            label: 'High Value',
            conditionType: 'value',
            valueOperator: '>',
            valueAmount: 50000
          }},
          {id: 'router_1', type: 'router', position: {x: 350, y: 200}, data: {
            label: 'Stage Router',
            description: 'Route by stage'
          }},
          {id: 'action_1', type: 'action', position: {x: 550, y: 50}, data: {
            label: 'Executive Alert', 
            type: 'send_slack',
            iconName: 'Slack',
            slackChannel: 'executive-deals',
            slackMessageType: 'blocks',
            slackBlocks: `[{
              "type": "section",
              "text": {"type": "mrkdwn", "text": "🎯 *High Value Deal Movement*\\n*Deal:* {{deal_name}}\\n*Value:* $\{{value}}\\n*New Stage:* {{stage}}"}
            }]`
          }},
          {id: 'action_2', type: 'action', position: {x: 550, y: 150}, data: {
            label: 'Sales Channel', 
            type: 'send_slack',
            iconName: 'Slack',
            slackChannel: 'sales-wins',
            slackMessage: '✅ {{deal_name}} moved to {{stage}}'
          }},
          {id: 'action_3', type: 'action', position: {x: 550, y: 250}, data: {
            label: 'Log Activity', 
            type: 'add_note',
            iconName: 'FileText',
            noteContent: 'Deal stage changed. Slack notification sent to {{channel}}',
            noteType: 'internal'
          }},
          {id: 'action_4', type: 'action', position: {x: 550, y: 350}, data: {
            label: 'Webhook', 
            type: 'send_webhook',
            iconName: 'Zap',
            webhookUrl: 'https://api.example.com/deal-update',
            httpMethod: 'POST',
            webhookPayload: '{"deal_id": "{{deal_id}}", "new_stage": "{{stage}}", "value": "{{value}}"}'
          }}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'trigger_1', target: 'router_1'},
          {id: 'e3', source: 'condition_1', target: 'action_1'},
          {id: 'e4', source: 'router_1', target: 'action_2', sourceHandle: 'a'},
          {id: 'e5', source: 'router_1', target: 'action_3', sourceHandle: 'b'},
          {id: 'e6', source: 'router_1', target: 'action_4', sourceHandle: 'c'}
        ]
      },
      trigger_type: 'stage_changed',
      trigger_conditions: {},
      action_type: 'multi_action',
      action_config: {actions: ['slack', 'webhook', 'note']},
      difficulty_level: 'hard',
      estimated_setup_time: 12,
      tags: ['sales', 'slack', 'notifications', 'webhooks', 'integration'],
      usage_count: 0,
      rating_avg: 5.0,
      rating_count: 0,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '12',
      name: '🔗 API Integration Hub',
      description: 'Webhook-driven workflow that receives external events, processes them, and updates your CRM with smart field mapping.',
      category: 'general',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {
            label: 'Webhook Received', 
            type: 'webhook_received',
            iconName: 'Zap',
            description: 'External API trigger',
            webhookSecret: 'your-secret-key'
          }},
          {id: 'condition_1', type: 'condition', position: {x: 250, y: 150}, data: {
            label: 'Check Source',
            conditionType: 'custom_field',
            customFieldName: 'integration_source',
            customFieldOperator: 'equals',
            customFieldValue: 'hubspot'
          }},
          {id: 'action_1', type: 'action', position: {x: 450, y: 100}, data: {
            label: 'Update CRM', 
            type: 'update_multiple_fields',
            iconName: 'TrendingUp',
            fieldUpdates: [
              {field: 'external_id', value: '{{webhook.id}}'},
              {field: 'sync_status', value: 'synced'},
              {field: 'last_sync', value: '{{timestamp}}'}
            ]
          }},
          {id: 'action_2', type: 'action', position: {x: 450, y: 200}, data: {
            label: 'Create Task', 
            type: 'create_task',
            iconName: 'CheckSquare',
            taskTitle: 'Review synced data from {{source}}'
          }},
          {id: 'action_3', type: 'action', position: {x: 450, y: 300}, data: {
            label: 'Send Confirmation', 
            type: 'send_webhook',
            iconName: 'Zap',
            webhookUrl: '{{webhook.callback_url}}',
            httpMethod: 'POST',
            webhookPayload: '{"status": "processed", "crm_id": "{{deal_id}}"}'
          }}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'condition_1', target: 'action_1'},
          {id: 'e3', source: 'condition_1', target: 'action_2'},
          {id: 'e4', source: 'action_2', target: 'action_3'}
        ]
      },
      trigger_type: 'webhook_received',
      trigger_conditions: {},
      action_type: 'multi_action',
      action_config: {actions: ['update_fields', 'create_task', 'webhook']},
      difficulty_level: 'hard',
      estimated_setup_time: 15,
      tags: ['integration', 'api', 'webhooks', 'automation', 'sync'],
      usage_count: 0,
      rating_avg: 5.0,
      rating_count: 0,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '13',
      name: '⏰ Smart Follow-up Cadence',
      description: 'Intelligent follow-up system with recurring tasks based on deal value, time since contact, and custom priority fields.',
      category: 'productivity',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {
            label: 'Activity Created', 
            type: 'activity_created',
            iconName: 'Activity',
            description: 'When activity is logged'
          }},
          {id: 'condition_1', type: 'condition', position: {x: 200, y: 100}, data: {
            label: 'Time Check',
            conditionType: 'time_since_contact',
            timeComparison: 'greater_than',
            daysSinceContact: 3
          }},
          {id: 'condition_2', type: 'condition', position: {x: 200, y: 200}, data: {
            label: 'Deal Size',
            conditionType: 'value',
            valueOperator: '>',
            valueAmount: 25000
          }},
          {id: 'condition_3', type: 'condition', position: {x: 200, y: 300}, data: {
            label: 'Custom Priority',
            conditionType: 'custom_field',
            customFieldName: 'follow_up_priority',
            customFieldOperator: 'not_equals',
            customFieldValue: 'low'
          }},
          {id: 'action_1', type: 'action', position: {x: 450, y: 50}, data: {
            label: 'Daily Follow-ups', 
            type: 'create_recurring_task',
            iconName: 'CheckSquare',
            taskTitle: '🔥 Daily: Follow up on {{deal_name}}',
            recurrencePattern: 'daily',
            occurrences: 5
          }},
          {id: 'action_2', type: 'action', position: {x: 450, y: 150}, data: {
            label: 'Weekly Check-ins', 
            type: 'create_recurring_task',
            iconName: 'CheckSquare',
            taskTitle: '📅 Weekly: Check in on {{deal_name}}',
            recurrencePattern: 'weekly',
            occurrences: 4
          }},
          {id: 'action_3', type: 'action', position: {x: 450, y: 250}, data: {
            label: 'Update Priority', 
            type: 'update_multiple_fields',
            iconName: 'TrendingUp',
            fieldUpdates: [
              {field: 'follow_up_status', value: 'active'},
              {field: 'last_cadence_start', value: '{{today}}'}
            ]
          }},
          {id: 'action_4', type: 'action', position: {x: 450, y: 350}, data: {
            label: 'Track Engagement', 
            type: 'add_note',
            iconName: 'FileText',
            noteContent: 'Follow-up cadence started. Type: {{cadence_type}}, Duration: {{duration}}',
            noteType: 'internal'
          }}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'trigger_1', target: 'condition_2'},
          {id: 'e3', source: 'trigger_1', target: 'condition_3'},
          {id: 'e4', source: 'condition_1', target: 'action_1'},
          {id: 'e5', source: 'condition_2', target: 'action_2'},
          {id: 'e6', source: 'condition_3', target: 'action_3'},
          {id: 'e7', source: 'action_3', target: 'action_4'}
        ]
      },
      trigger_type: 'activity_created',
      trigger_conditions: {},
      action_type: 'multi_action',
      action_config: {actions: ['recurring_tasks', 'field_updates', 'notes']},
      difficulty_level: 'hard',
      estimated_setup_time: 10,
      tags: ['productivity', 'follow-up', 'automation', 'cadence', 'tasks'],
      usage_count: 0,
      rating_avg: 5.0,
      rating_count: 0,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    // ADVANCED COMPLEXITY (Original templates continue)
    {
      id: '14',
      name: 'Deal Velocity Optimizer',
      description: 'Complex workflow that monitors deal progression speed and accelerates stuck deals.',
      category: 'sales',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 200}, data: {label: 'Daily Check', type: 'scheduled', iconName: 'Clock'}},
          {id: 'condition_1', type: 'condition', position: {x: 200, y: 100}, data: {label: 'SQL > 14 days', condition: 'stage = SQL AND days_in_stage > 14'}},
          {id: 'condition_2', type: 'condition', position: {x: 200, y: 200}, data: {label: 'Opp > 21 days', condition: 'stage = Opportunity AND days_in_stage > 21'}},
          {id: 'condition_3', type: 'condition', position: {x: 200, y: 300}, data: {label: 'Verbal > 7 days', condition: 'stage = Verbal AND days_in_stage > 7'}},
          {id: 'condition_4', type: 'condition', position: {x: 400, y: 150}, data: {label: 'High Value?', condition: 'deal_value > 25000'}},
          {id: 'action_1', type: 'action', position: {x: 600, y: 50}, data: {label: 'Escalate to Manager', type: 'send_notification', iconName: 'AlertTriangle'}},
          {id: 'action_2', type: 'action', position: {x: 600, y: 150}, data: {label: 'Create Acceleration Plan', type: 'create_task', iconName: 'Zap'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'condition_1'},
          {id: 'e2', source: 'trigger_1', target: 'condition_2'},
          {id: 'e3', source: 'trigger_1', target: 'condition_3'},
          {id: 'e4', source: 'condition_1', target: 'condition_4'},
          {id: 'e5', source: 'condition_2', target: 'condition_4'},
          {id: 'e6', source: 'condition_4', target: 'action_1'},
          {id: 'e7', source: 'condition_4', target: 'action_2'}
        ]
      },
      trigger_type: 'scheduled',
      trigger_conditions: {frequency: 'daily'},
      action_type: 'complex_automation',
      action_config: {velocity_targets: true},
      difficulty_level: 'hard',
      estimated_setup_time: 15,
      tags: ['sales', 'velocity', 'optimization'],
      usage_count: 78,
      rating_avg: 4.3,
      rating_count: 120,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '10',
      name: 'RevOps Command Center',
      description: 'Enterprise-grade workflow orchestrating multiple teams and tracking SLAs.',
      category: 'general',
      canvas_data: {
        nodes: [
          {id: 'trigger_1', type: 'trigger', position: {x: 50, y: 300}, data: {label: 'Any Stage Change', type: 'stage_changed', iconName: 'Target'}},
          {id: 'router_1', type: 'router', position: {x: 200, y: 300}, data: {label: 'Stage Router'}},
          {id: 'condition_1', type: 'condition', position: {x: 400, y: 100}, data: {label: 'New SQL', condition: 'new_stage = SQL'}},
          {id: 'condition_2', type: 'condition', position: {x: 400, y: 200}, data: {label: 'New Opportunity', condition: 'new_stage = Opportunity'}},
          {id: 'condition_3', type: 'condition', position: {x: 400, y: 300}, data: {label: 'New Verbal', condition: 'new_stage = Verbal'}},
          {id: 'condition_4', type: 'condition', position: {x: 400, y: 400}, data: {label: 'New Signed', condition: 'new_stage = Signed'}},
          {id: 'action_1', type: 'action', position: {x: 800, y: 100}, data: {label: 'SDR Handoff', type: 'multi_action', iconName: 'Users'}},
          {id: 'action_2', type: 'action', position: {x: 800, y: 200}, data: {label: 'AE Actions', type: 'multi_action', iconName: 'Briefcase'}},
          {id: 'action_3', type: 'action', position: {x: 800, y: 300}, data: {label: 'Deal Desk', type: 'multi_action', iconName: 'FileText'}},
          {id: 'action_4', type: 'action', position: {x: 800, y: 400}, data: {label: 'CS Handoff', type: 'multi_action', iconName: 'Heart'}}
        ],
        edges: [
          {id: 'e1', source: 'trigger_1', target: 'router_1'},
          {id: 'e2', source: 'router_1', target: 'condition_1'},
          {id: 'e3', source: 'router_1', target: 'condition_2'},
          {id: 'e4', source: 'router_1', target: 'condition_3'},
          {id: 'e5', source: 'router_1', target: 'condition_4'},
          {id: 'e6', source: 'condition_1', target: 'action_1'},
          {id: 'e7', source: 'condition_2', target: 'action_2'},
          {id: 'e8', source: 'condition_3', target: 'action_3'},
          {id: 'e9', source: 'condition_4', target: 'action_4'}
        ]
      },
      trigger_type: 'stage_changed',
      trigger_conditions: {},
      action_type: 'revenue_orchestration',
      action_config: {orchestration_rules: true, sla_tracking: true},
      difficulty_level: 'hard',
      estimated_setup_time: 20,
      tags: ['revenue-operations', 'enterprise', 'orchestration'],
      usage_count: 75,
      rating_avg: 4.2,
      rating_count: 100,
      is_public: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
};

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onSelectTemplate }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'usage_count' | 'difficulty_level' | 'name' | 'rating_avg'>('usage_count');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // For now, always use default templates since the database table doesn't exist yet
      // This ensures templates are always available
      setTemplates(getDefaultTemplates());
      
      // Try to load from database as well (for future when table exists)
      try {
        const { data, error } = await supabase
          .from('workflow_templates')
          .select('*')
          .eq('is_public', true)
          .order('popularity', { ascending: false });

        if (!error && data && data.length > 0) {
          // If we successfully get templates from DB, use those instead
          setTemplates(data);
        }
      } catch (dbError) {
        // Silently fail - we already have default templates loaded
        console.log('Using default templates (database table not yet available)');
      }
    } catch (error) {
      console.error('Error in loadTemplates:', error);
      // Ensure we always have templates
      setTemplates(getDefaultTemplates());
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    try {
      // Try to increment usage count (but don't fail if table doesn't exist)
      try {
        await supabase
          .from('workflow_templates')
          .update({ usage_count: template.usage_count + 1 })
          .eq('id', template.id);
      } catch (dbError) {
        // Silently fail - template selection should still work
        console.log('Could not update usage count (database table not yet available)');
      }

      // Convert template to workflow format for the canvas
      const workflowData = {
        id: template.id,
        name: template.name,
        description: template.description,
        canvas_data: template.canvas_data,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_conditions,
        action_type: template.action_type,
        action_config: template.action_config,
        is_active: false, // Start inactive
        template_id: template.id
      };

      onSelectTemplate(workflowData);
    } catch (error) {
      console.error('Error selecting template:', error);
      // Still try to use the template even if there was an error
      const workflowData = {
        id: template.id,
        name: template.name,
        description: template.description,
        canvas_data: template.canvas_data,
        trigger_type: template.trigger_type,
        trigger_config: template.trigger_conditions,
        action_type: template.action_type,
        action_config: template.action_config,
        is_active: false,
        template_id: template.id
      };
      onSelectTemplate(workflowData);
    }
  };

  const filteredTemplates = templates
    .filter(t => selectedCategory === 'All' || t.category === selectedCategory)
    .filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      if (sortBy === 'usage_count') return b.usage_count - a.usage_count;
      if (sortBy === 'rating_avg') return (b.rating_avg || 0) - (a.rating_avg || 0);
      if (sortBy === 'difficulty_level') {
        const diffOrder = { easy: 0, medium: 1, hard: 2 };
        return diffOrder[a.difficulty_level] - diffOrder[b.difficulty_level];
      }
      return a.name.localeCompare(b.name);
    });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-400 bg-green-400/10';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10';
      case 'hard': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#37bd7e]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Template Library</h2>
            <p className="text-gray-400">Start with a pre-built workflow template and customize it to your needs</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">{templates.length} templates available</p>
            <p className="text-xs text-gray-500">Community curated workflows</p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                selectedCategory === category
                  ? 'bg-[#37bd7e] text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-[#37bd7e] outline-none transition-colors"
        >
          <option value="usage_count">Most Popular</option>
          <option value="rating_avg">Highest Rated</option>
          <option value="difficulty_level">Difficulty</option>
          <option value="name">Name</option>
        </select>
      </div>

      {/* Template Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => {
          // Get appropriate icon based on trigger/action type
          const getTemplateIcon = () => {
            if (template.trigger_type === 'stage_changed') return Target;
            if (template.trigger_type === 'activity_created') return Activity;
            if (template.trigger_type === 'deal_created') return Database;
            if (template.action_type === 'create_task') return CheckSquare;
            if (template.action_type === 'send_notification') return Bell;
            return GitBranch;
          };
          
          const Icon = getTemplateIcon();
          const categoryColor = categoryColors[template.category] || categoryColors.general;
          
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => handleTemplateSelect(template)}
              className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-6 cursor-pointer hover:border-[#37bd7e]/50 transition-all group"
            >
              {/* Icon and Category */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${categoryColor} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(template.difficulty_level)}`}>
                    {template.difficulty_level}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-xs text-gray-400">
                      {template.rating_count > 0 ? template.rating_avg.toFixed(1) : 'New'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title and Description */}
              <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#37bd7e] transition-colors">
                {template.name}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {template.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {template.tags?.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-gray-800/50 rounded text-xs text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{template.estimated_setup_time} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <TrendingUp className="w-3 h-3" />
                    <span>{template.usage_count} uses</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#37bd7e] opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-medium">Use Template</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-400 mb-1">No templates found</h3>
          <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Featured Badge */}
      <div className="mt-12 p-6 bg-gradient-to-r from-[#37bd7e]/10 to-purple-600/10 rounded-lg border border-[#37bd7e]/20">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-[#37bd7e]" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Want a custom template?</h3>
            <p className="text-sm text-gray-400">
              Contact our team to create a custom workflow template tailored to your specific needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;