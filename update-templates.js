const fs = require('fs');

// Read the current file
const filePath = '/Users/andrewbryce/Documents/sixty-sales-dashboard/src/components/admin/WorkflowsTestSuite.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update template 6 - Lead Scoring & Routing
const template6Old = /const testLeadScoringRoutingTemplate = async[\s\S]*?return {[\s\S]*?};[\s\S]*?};/;
const template6New = `const testLeadScoringRoutingTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '6',
      name: 'Lead Scoring & Routing',
      description: 'Score leads based on engagement and route high-value leads',
      trigger_type: 'activity_created',
      trigger_config: {},
      action_type: 'update_field',
      action_config: { scoring_rules: true, routing_threshold: 50 },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { label: 'Activity Logged', type: 'activity_created' }
          },
          {
            id: 'condition_1',
            type: 'condition',
            position: { x: 300, y: 100 },
            data: { label: 'Email Opened', condition: 'activity_type = email_opened' }
          },
          {
            id: 'condition_2',
            type: 'condition',
            position: { x: 300, y: 200 },
            data: { label: 'Meeting Booked', condition: 'activity_type = meeting' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 500, y: 100 },
            data: { label: 'Increase Score', type: 'update_field' }
          },
          {
            id: 'action_2',
            type: 'action',
            position: { x: 500, y: 200 },
            data: { label: 'Assign Senior Rep', type: 'assign_owner' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'condition_1' },
          { id: 'e2', source: 'trigger_1', target: 'condition_2' },
          { id: 'e3', source: 'condition_1', target: 'action_1' },
          { id: 'e4', source: 'condition_2', target: 'action_2' }
        ]
      },
      category: 'sales',
      difficulty_level: 'medium'
    };
    
    if (template.trigger_type !== 'activity_created') {
      return { ...test, status: 'failed', message: 'Must trigger on activity' };
    }
    const conditionCount = template.canvas_data?.nodes.filter(n => n.type === 'condition').length || 0;
    if (conditionCount < 2) {
      return { ...test, status: 'failed', message: 'Must have multiple scoring conditions' };
    }
    const hasUpdateField = template.canvas_data?.nodes.some(n => n.data.type === 'update_field');
    const hasAssignOwner = template.canvas_data?.nodes.some(n => n.data.type === 'assign_owner');
    if (!hasUpdateField || !hasAssignOwner) {
      return { ...test, status: 'failed', message: 'Must update score and route leads' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Lead Scoring & Routing template valid',
      details: { conditions: conditionCount, hasScoring: true, hasRouting: true }
    };
  };`;

if (template6Old.test(content)) {
  content = content.replace(template6Old, template6New);
  console.log('✅ Updated template 6 - Lead Scoring & Routing');
} else {
  console.log('❌ Could not find template 6 pattern');
}

// Write the updated content back
fs.writeFileSync(filePath, content, 'utf8');
console.log('File updated successfully!');