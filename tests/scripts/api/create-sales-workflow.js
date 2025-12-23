import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSalesWorkflow() {
  console.log('🔍 Looking up Andrew\'s user ID...');
  
  // First, find Andrew's user ID
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError) {
    console.error('❌ Error fetching users:', userError);
    return;
  }
  
  const andrewUser = users.users.find(u => u.email === 'andrew.bryce@sixtyseconds.video');
  
  if (!andrewUser) {
    console.error('❌ Andrew not found in auth.users');
    return;
  }
  
  console.log('✅ Found Andrew:', andrewUser.id);
  
  // Check if workflow already exists
  const { data: existingWorkflow, error: checkError } = await supabase
    .from('user_automation_rules')
    .select('*')
    .eq('user_id', andrewUser.id)
    .eq('rule_name', 'Sales Analysis Workflow')
    .single();
  
  if (existingWorkflow) {
    console.log('⚠️ Workflow already exists for Andrew');
    return;
  }
  
  console.log('📝 Creating Sales Analysis Workflow...');
  
  // Create the workflow with correct column names
  const workflowData = {
    user_id: andrewUser.id,
    rule_name: 'Sales Analysis Workflow',
    rule_description: 'Comprehensive sales meeting analysis with automated insights and task creation',
    trigger_type: 'webhook',
    trigger_conditions: {
      webhook_url: '/api/workflows/webhook/sales-analysis',
      source: 'fathom'
    },
    action_type: 'create_task', // Use an allowed action_type
    action_config: {
      workflow_id: 'sales-analysis-workflow',
      nodes: [
        {
          id: 'webhook-receiver',
          type: 'trigger',
          data: {
            label: 'Webhook Receiver',
            description: 'Receives Fathom webhook data'
          },
          position: { x: 250, y: 100 }
        },
        {
          id: 'task-categorizer',
          type: 'processor',
          data: {
            label: 'Task Categorizer',
            description: 'Categorizes meeting tasks and action items'
          },
          position: { x: 250, y: 200 }
        },
        {
          id: 'call-analyzer',
          type: 'processor',
          data: {
            label: 'Call Analyzer',
            description: 'Analyzes call quality and extracts insights'
          },
          position: { x: 250, y: 300 }
        },
        {
          id: 'metrics-calculator',
          type: 'processor',
          data: {
            label: 'Metrics Calculator',
            description: 'Calculates performance metrics'
          },
          position: { x: 250, y: 400 }
        },
        {
          id: 'sales-coach',
          type: 'processor',
          data: {
            label: 'Sales Coach',
            description: 'Provides coaching insights'
          },
          position: { x: 250, y: 500 }
        },
        {
          id: 'doc-creator',
          type: 'action',
          data: {
            label: 'Google Doc Creator',
            description: 'Creates meeting summary document'
          },
          position: { x: 250, y: 600 }
        },
        {
          id: 'database-saver',
          type: 'action',
          data: {
            label: 'Database Saver',
            description: 'Saves meeting to database'
          },
          position: { x: 250, y: 700 }
        },
        {
          id: 'task-creator',
          type: 'action',
          data: {
            label: 'Task Creator',
            description: 'Creates follow-up tasks'
          },
          position: { x: 250, y: 800 }
        }
      ],
      edges: [
        { id: 'e1', source: 'webhook-receiver', target: 'task-categorizer' },
        { id: 'e2', source: 'task-categorizer', target: 'call-analyzer' },
        { id: 'e3', source: 'call-analyzer', target: 'metrics-calculator' },
        { id: 'e4', source: 'metrics-calculator', target: 'sales-coach' },
        { id: 'e5', source: 'sales-coach', target: 'doc-creator' },
        { id: 'e6', source: 'doc-creator', target: 'database-saver' },
        { id: 'e7', source: 'database-saver', target: 'task-creator' }
      ]
    },
    canvas_data: {
      nodes: [
        {
          id: 'webhook-receiver',
          type: 'trigger',
          data: {
            label: 'Webhook Receiver',
            description: 'Receives Fathom webhook data'
          },
          position: { x: 250, y: 100 }
        },
        {
          id: 'task-categorizer',
          type: 'processor',
          data: {
            label: 'Task Categorizer',
            description: 'Categorizes meeting tasks and action items'
          },
          position: { x: 250, y: 200 }
        },
        {
          id: 'call-analyzer',
          type: 'processor',
          data: {
            label: 'Call Analyzer',
            description: 'Analyzes call quality and extracts insights'
          },
          position: { x: 250, y: 300 }
        },
        {
          id: 'metrics-calculator',
          type: 'processor',
          data: {
            label: 'Metrics Calculator',
            description: 'Calculates performance metrics'
          },
          position: { x: 250, y: 400 }
        },
        {
          id: 'sales-coach',
          type: 'processor',
          data: {
            label: 'Sales Coach',
            description: 'Provides coaching insights'
          },
          position: { x: 250, y: 500 }
        },
        {
          id: 'doc-creator',
          type: 'action',
          data: {
            label: 'Google Doc Creator',
            description: 'Creates meeting summary document'
          },
          position: { x: 250, y: 600 }
        },
        {
          id: 'database-saver',
          type: 'action',
          data: {
            label: 'Database Saver',
            description: 'Saves meeting to database'
          },
          position: { x: 250, y: 700 }
        },
        {
          id: 'task-creator',
          type: 'action',
          data: {
            label: 'Task Creator',
            description: 'Creates follow-up tasks'
          },
          position: { x: 250, y: 800 }
        }
      ],
      edges: [
        { id: 'e1', source: 'webhook-receiver', target: 'task-categorizer' },
        { id: 'e2', source: 'task-categorizer', target: 'call-analyzer' },
        { id: 'e3', source: 'call-analyzer', target: 'metrics-calculator' },
        { id: 'e4', source: 'metrics-calculator', target: 'sales-coach' },
        { id: 'e5', source: 'sales-coach', target: 'doc-creator' },
        { id: 'e6', source: 'doc-creator', target: 'database-saver' },
        { id: 'e7', source: 'database-saver', target: 'task-creator' }
      ]
    },
    is_active: true,
    priority_level: 1,
    template_id: 'sales-analysis-workflow'
  };
  
  const { data, error } = await supabase
    .from('user_automation_rules')
    .insert(workflowData)
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error creating workflow:', error);
    return;
  }
  
  console.log('✅ Sales Analysis Workflow created successfully!');
  console.log('📊 Workflow ID:', data.id);
  console.log('👤 Owner:', andrewUser.email);
  console.log('🔗 View at: http://localhost:5173/workflows (My Workflows tab)');
}

createSalesWorkflow().catch(console.error);