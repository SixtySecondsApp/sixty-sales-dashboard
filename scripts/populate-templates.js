import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY; // Using anon key for now

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const templates = [
  // BASIC COMPLEXITY
  {
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
    popularity: 95,
    is_public: true
  },
  {
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
    popularity: 92,
    is_public: true
  },
  {
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
    popularity: 88,
    is_public: true
  },
  {
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
    popularity: 90,
    is_public: true
  },
  // INTERMEDIATE COMPLEXITY
  {
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
    popularity: 93,
    is_public: true
  },
  {
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
    popularity: 87,
    is_public: true
  },
  {
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
    popularity: 85,
    is_public: true
  },
  {
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
    popularity: 82,
    is_public: true
  },
  // ADVANCED COMPLEXITY
  {
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
    popularity: 78,
    is_public: true
  },
  {
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
    popularity: 75,
    is_public: true
  }
];

async function populateTemplates() {
  console.log('Starting to populate workflow templates...');
  
  try {
    // First, check if templates already exist
    const { data: existingTemplates, error: checkError } = await supabase
      .from('workflow_templates')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing templates:', checkError);
      return;
    }
    
    if (existingTemplates && existingTemplates.length > 0) {
      console.log('Templates already exist in database. Skipping population.');
      return;
    }
    
    // Insert all templates
    const { data, error } = await supabase
      .from('workflow_templates')
      .insert(templates)
      .select();
    
    if (error) {
      console.error('Error inserting templates:', error);
      return;
    }
    
    console.log(`Successfully inserted ${data.length} templates`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

populateTemplates();