// Script to generate correct template test implementations
const templates = [
  {
    id: '1',
    name: 'Instant Lead Welcome',
    trigger_type: 'deal_created',
    action_type: 'create_task',
    validations: [
      "template.trigger_type === 'deal_created'",
      "template.action_type === 'create_task'",
      "template.action_config?.priority === 'high'"
    ]
  },
  {
    id: '2', 
    name: 'Post-Meeting Action Items',
    trigger_type: 'activity_created',
    action_type: 'create_task',
    validations: [
      "template.trigger_type === 'activity_created'",
      "template.trigger_config?.activity_type === 'meeting'",
      "template.action_type === 'create_task'"
    ]
  },
  {
    id: '3',
    name: 'Deal Won Notification',
    trigger_type: 'stage_changed',
    action_type: 'send_notification',
    validations: [
      "template.trigger_config?.stage === 'Signed'",
      "template.action_type === 'send_notification'",
      "template.action_config?.notify_team === true"
    ]
  },
  {
    id: '4',
    name: 'Stale Opportunity Alert',
    trigger_type: 'no_activity',
    action_type: 'create_task',
    validations: [
      "template.trigger_type === 'no_activity'",
      "template.trigger_config?.days_inactive === 7",
      "template.action_type === 'create_task'"
    ]
  },
  {
    id: '5',
    name: 'Smart Proposal Follow-up',
    trigger_type: 'activity_created',
    action_type: 'create_sequence',
    validations: [
      "template.trigger_type === 'activity_created'",
      "template.trigger_config?.activity_type === 'proposal'",
      "template.canvas_data?.nodes.some(n => n.type === 'condition')",
      "template.canvas_data?.nodes.filter(n => n.type === 'action').length >= 2"
    ]
  },
  {
    id: '6',
    name: 'Lead Scoring & Routing',
    trigger_type: 'activity_created',
    action_type: 'update_field',
    validations: [
      "template.trigger_type === 'activity_created'",
      "template.canvas_data?.nodes.filter(n => n.type === 'condition').length >= 2",
      "template.canvas_data?.nodes.some(n => n.data.type === 'update_field')",
      "template.canvas_data?.nodes.some(n => n.data.type === 'assign_owner')"
    ]
  },
  {
    id: '7',
    name: 'Sales to Success Handoff',
    trigger_type: 'stage_changed',
    action_type: 'create_multiple',
    validations: [
      "template.trigger_config?.stage === 'Signed'",
      "template.canvas_data?.nodes.filter(n => n.type === 'action').length >= 3",
      "template.category === 'customer success'"
    ]
  },
  {
    id: '8',
    name: 'Lost Deal Win-back',
    trigger_type: 'time_based',
    action_type: 'create_task',
    validations: [
      "template.trigger_type === 'time_based'",
      "template.trigger_config?.days_since_lost === 90",
      "template.canvas_data?.nodes.some(n => n.type === 'condition')"
    ]
  },
  {
    id: '9',
    name: 'Deal Velocity Optimizer',
    trigger_type: 'scheduled',
    action_type: 'complex_automation',
    validations: [
      "template.trigger_type === 'scheduled'",
      "template.trigger_config?.frequency === 'daily'",
      "template.canvas_data?.nodes.filter(n => n.type === 'condition').length >= 4",
      "template.canvas_data?.nodes.length >= 7"
    ]
  },
  {
    id: '10',
    name: 'RevOps Command Center',
    trigger_type: 'stage_changed',
    action_type: 'revenue_orchestration',
    validations: [
      "template.trigger_type === 'stage_changed'",
      "template.canvas_data?.nodes.some(n => n.type === 'router')",
      "template.canvas_data?.nodes.filter(n => n.type === 'condition').length >= 4",
      "template.canvas_data?.nodes.length >= 10"
    ]
  }
];

// Generate validation summary
console.log('Template Test Validation Summary:\n');
templates.forEach(t => {
  console.log(`${t.id}. ${t.name}:`);
  console.log(`   Trigger: ${t.trigger_type}`);
  console.log(`   Action: ${t.action_type}`);
  console.log(`   Tests: ${t.validations.length} validation checks`);
  console.log('');
});

console.log('\n✅ All 10 templates have proper test definitions');
console.log('⚠️  Need to implement these in WorkflowsTestSuite.tsx');