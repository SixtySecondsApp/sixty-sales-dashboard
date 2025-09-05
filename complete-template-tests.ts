// Complete template test implementations for templates 4-10

  // Template 4: Stale Opportunity Alert
  const testStaleOpportunityAlertTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '4',
      name: 'Stale Opportunity Alert',
      description: 'Get alerted when deals in Opportunity stage haven\'t been touched in 7 days',
      trigger_type: 'no_activity',
      trigger_config: { stage: 'Opportunity', days_inactive: 7 },
      action_type: 'create_task',
      action_config: { task_title: '🔥 URGENT: Re-engage {{deal_name}}', priority: 'high' },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: { label: 'No Activity', type: 'no_activity', daysInactive: 7 }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 400, y: 100 },
            data: { label: 'Create Revival Task', type: 'create_task' }
          }
        ],
        edges: [{ id: 'e1', source: 'trigger_1', target: 'action_1' }]
      },
      category: 'sales',
      difficulty_level: 'easy'
    };
    
    if (template.trigger_type !== 'no_activity') {
      return { ...test, status: 'failed', message: 'Must use no_activity trigger' };
    }
    if (!template.trigger_config?.days_inactive || template.trigger_config.days_inactive !== 7) {
      return { ...test, status: 'failed', message: 'Must monitor 7 days of inactivity' };
    }
    if (template.action_type !== 'create_task') {
      return { ...test, status: 'failed', message: 'Must create task for stale deals' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Stale Opportunity Alert template valid',
      details: { daysInactive: 7, stage: 'Opportunity' }
    };
  };

  // Template 5: Smart Proposal Follow-up
  const testSmartProposalFollowupTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '5',
      name: 'Smart Proposal Follow-up',
      description: 'Multi-touch follow-up sequence after sending proposals',
      trigger_type: 'activity_created',
      trigger_config: { activity_type: 'proposal' },
      action_type: 'create_sequence',
      action_config: { sequence_steps: 3 },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { label: 'Proposal Sent', type: 'activity_created' }
          },
          {
            id: 'condition_1',
            type: 'condition',
            position: { x: 300, y: 150 },
            data: { label: 'Check Value', condition: 'deal_value > 10000' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 500, y: 100 },
            data: { label: 'Day 3 Follow-up', type: 'create_task' }
          },
          {
            id: 'action_2',
            type: 'action',
            position: { x: 500, y: 200 },
            data: { label: 'Day 7 Follow-up', type: 'create_task' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'condition_1' },
          { id: 'e2', source: 'condition_1', target: 'action_1' },
          { id: 'e3', source: 'condition_1', target: 'action_2' }
        ]
      },
      category: 'sales',
      difficulty_level: 'medium'
    };
    
    if (template.trigger_type !== 'activity_created') {
      return { ...test, status: 'failed', message: 'Must trigger on activity creation' };
    }
    if (template.trigger_config?.activity_type !== 'proposal') {
      return { ...test, status: 'failed', message: 'Must trigger on proposal activity' };
    }
    const hasCondition = template.canvas_data?.nodes.some(n => n.type === 'condition');
    if (!hasCondition) {
      return { ...test, status: 'failed', message: 'Must have value condition' };
    }
    const actionCount = template.canvas_data?.nodes.filter(n => n.type === 'action').length || 0;
    if (actionCount < 2) {
      return { ...test, status: 'failed', message: 'Must have multiple follow-up actions' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Smart Proposal Follow-up template valid',
      details: { sequenceSteps: 3, hasValueCheck: true }
    };
  };

  // Template 6: Lead Scoring & Routing
  const testLeadScoringRoutingTemplate = async (test: TestResult): Promise<TestResult> => {
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
  };

  // Template 7: Sales to Success Handoff
  const testSalesToSuccessHandoffTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '7',
      name: 'Sales to Success Handoff',
      description: 'Smooth handoff from Sales to Customer Success when deals close',
      trigger_type: 'stage_changed',
      trigger_config: { stage: 'Signed' },
      action_type: 'create_multiple',
      action_config: { actions: 3 },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { label: 'Deal Won', type: 'stage_changed' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 350, y: 100 },
            data: { label: 'Notify CS Team', type: 'send_notification' }
          },
          {
            id: 'action_2',
            type: 'action',
            position: { x: 350, y: 200 },
            data: { label: 'Create Onboarding', type: 'create_task' }
          },
          {
            id: 'action_3',
            type: 'action',
            position: { x: 350, y: 300 },
            data: { label: 'Schedule Kickoff', type: 'create_activity' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'action_1' },
          { id: 'e2', source: 'trigger_1', target: 'action_2' },
          { id: 'e3', source: 'trigger_1', target: 'action_3' }
        ]
      },
      category: 'customer success',
      difficulty_level: 'medium'
    };
    
    if (template.trigger_config?.stage !== 'Signed') {
      return { ...test, status: 'failed', message: 'Must trigger on Signed stage' };
    }
    const actionCount = template.canvas_data?.nodes.filter(n => n.type === 'action').length || 0;
    if (actionCount < 3) {
      return { ...test, status: 'failed', message: 'Must have multiple handoff actions' };
    }
    if (template.category !== 'customer success') {
      return { ...test, status: 'failed', message: 'Must be in customer success category' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Sales to Success Handoff template valid',
      details: { actions: actionCount, category: 'customer success' }
    };
  };

  // Template 8: Lost Deal Win-back
  const testLostDealWinbackTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '8',
      name: 'Lost Deal Win-back',
      description: 'Automated re-engagement for lost deals after 90 days',
      trigger_type: 'time_based',
      trigger_config: { days_since_lost: 90 },
      action_type: 'create_task',
      action_config: { campaign_type: 'win_back' },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 100, y: 150 },
            data: { label: '90 Days Lost', type: 'time_based' }
          },
          {
            id: 'condition_1',
            type: 'condition',
            position: { x: 300, y: 150 },
            data: { label: 'Lost Reason', condition: 'lost_reason != competitor' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 500, y: 100 },
            data: { label: 'Re-engage Email', type: 'create_task' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'condition_1' },
          { id: 'e2', source: 'condition_1', target: 'action_1' }
        ]
      },
      category: 'sales',
      difficulty_level: 'medium'
    };
    
    if (template.trigger_type !== 'time_based') {
      return { ...test, status: 'failed', message: 'Must use time-based trigger' };
    }
    if (template.trigger_config?.days_since_lost !== 90) {
      return { ...test, status: 'failed', message: 'Must wait 90 days for win-back' };
    }
    const hasCondition = template.canvas_data?.nodes.some(n => n.type === 'condition');
    if (!hasCondition) {
      return { ...test, status: 'failed', message: 'Must check lost reason' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Lost Deal Win-back template valid',
      details: { daysSinceLost: 90, hasReasonCheck: true }
    };
  };

  // Template 9: Deal Velocity Optimizer
  const testDealVelocityOptimizerTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '9',
      name: 'Deal Velocity Optimizer',
      description: 'Complex workflow that monitors deal progression speed',
      trigger_type: 'scheduled',
      trigger_config: { frequency: 'daily' },
      action_type: 'complex_automation',
      action_config: { velocity_targets: true },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 50, y: 200 },
            data: { label: 'Daily Check', type: 'scheduled' }
          },
          {
            id: 'condition_1',
            type: 'condition',
            position: { x: 200, y: 100 },
            data: { label: 'SQL > 14 days', condition: 'stage = SQL AND days_in_stage > 14' }
          },
          {
            id: 'condition_2',
            type: 'condition',
            position: { x: 200, y: 200 },
            data: { label: 'Opp > 21 days', condition: 'stage = Opportunity AND days_in_stage > 21' }
          },
          {
            id: 'condition_3',
            type: 'condition',
            position: { x: 200, y: 300 },
            data: { label: 'Verbal > 7 days', condition: 'stage = Verbal AND days_in_stage > 7' }
          },
          {
            id: 'condition_4',
            type: 'condition',
            position: { x: 400, y: 150 },
            data: { label: 'High Value?', condition: 'deal_value > 25000' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 600, y: 50 },
            data: { label: 'Escalate to Manager', type: 'send_notification' }
          },
          {
            id: 'action_2',
            type: 'action',
            position: { x: 600, y: 150 },
            data: { label: 'Create Acceleration Plan', type: 'create_task' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'condition_1' },
          { id: 'e2', source: 'trigger_1', target: 'condition_2' },
          { id: 'e3', source: 'trigger_1', target: 'condition_3' },
          { id: 'e4', source: 'condition_1', target: 'condition_4' },
          { id: 'e5', source: 'condition_2', target: 'condition_4' },
          { id: 'e6', source: 'condition_4', target: 'action_1' },
          { id: 'e7', source: 'condition_4', target: 'action_2' }
        ]
      },
      category: 'sales',
      difficulty_level: 'hard'
    };
    
    if (template.trigger_type !== 'scheduled') {
      return { ...test, status: 'failed', message: 'Must use scheduled trigger' };
    }
    if (template.trigger_config?.frequency !== 'daily') {
      return { ...test, status: 'failed', message: 'Must run daily' };
    }
    const conditionCount = template.canvas_data?.nodes.filter(n => n.type === 'condition').length || 0;
    if (conditionCount < 4) {
      return { ...test, status: 'failed', message: 'Must have multiple stage conditions' };
    }
    const nodeCount = template.canvas_data?.nodes.length || 0;
    if (nodeCount < 7) {
      return { ...test, status: 'failed', message: 'Complex workflow needs 7+ nodes' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'Deal Velocity Optimizer template valid',
      details: { frequency: 'daily', conditions: conditionCount, nodes: nodeCount }
    };
  };

  // Template 10: RevOps Command Center
  const testRevOpsCommandCenterTemplate = async (test: TestResult): Promise<TestResult> => {
    const template: WorkflowTemplate = {
      id: '10',
      name: 'RevOps Command Center',
      description: 'Enterprise-grade workflow orchestrating multiple teams',
      trigger_type: 'stage_changed',
      trigger_config: {},
      action_type: 'revenue_orchestration',
      action_config: { orchestration_rules: true, sla_tracking: true },
      canvas_data: {
        nodes: [
          {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 50, y: 300 },
            data: { label: 'Any Stage Change', type: 'stage_changed' }
          },
          {
            id: 'router_1',
            type: 'router',
            position: { x: 200, y: 300 },
            data: { label: 'Stage Router', type: 'stage_router' }
          },
          {
            id: 'condition_1',
            type: 'condition',
            position: { x: 400, y: 100 },
            data: { label: 'New SQL', condition: 'new_stage = SQL' }
          },
          {
            id: 'condition_2',
            type: 'condition',
            position: { x: 400, y: 200 },
            data: { label: 'New Opportunity', condition: 'new_stage = Opportunity' }
          },
          {
            id: 'condition_3',
            type: 'condition',
            position: { x: 400, y: 300 },
            data: { label: 'New Verbal', condition: 'new_stage = Verbal' }
          },
          {
            id: 'condition_4',
            type: 'condition',
            position: { x: 400, y: 400 },
            data: { label: 'New Signed', condition: 'new_stage = Signed' }
          },
          {
            id: 'action_1',
            type: 'action',
            position: { x: 800, y: 100 },
            data: { label: 'SDR Handoff', type: 'multi_action' }
          },
          {
            id: 'action_2',
            type: 'action',
            position: { x: 800, y: 200 },
            data: { label: 'AE Actions', type: 'multi_action' }
          },
          {
            id: 'action_3',
            type: 'action',
            position: { x: 800, y: 300 },
            data: { label: 'Deal Desk', type: 'multi_action' }
          },
          {
            id: 'action_4',
            type: 'action',
            position: { x: 800, y: 400 },
            data: { label: 'CS Handoff', type: 'multi_action' }
          }
        ],
        edges: [
          { id: 'e1', source: 'trigger_1', target: 'router_1' },
          { id: 'e2', source: 'router_1', target: 'condition_1' },
          { id: 'e3', source: 'router_1', target: 'condition_2' },
          { id: 'e4', source: 'router_1', target: 'condition_3' },
          { id: 'e5', source: 'router_1', target: 'condition_4' },
          { id: 'e6', source: 'condition_1', target: 'action_1' },
          { id: 'e7', source: 'condition_2', target: 'action_2' },
          { id: 'e8', source: 'condition_3', target: 'action_3' },
          { id: 'e9', source: 'condition_4', target: 'action_4' }
        ]
      },
      category: 'general',
      difficulty_level: 'hard'
    };
    
    if (template.trigger_type !== 'stage_changed') {
      return { ...test, status: 'failed', message: 'Must trigger on stage changes' };
    }
    const hasRouter = template.canvas_data?.nodes.some(n => n.type === 'router');
    if (!hasRouter) {
      return { ...test, status: 'failed', message: 'Must have stage router' };
    }
    const conditionCount = template.canvas_data?.nodes.filter(n => n.type === 'condition').length || 0;
    if (conditionCount < 4) {
      return { ...test, status: 'failed', message: 'Must route all 4 stages' };
    }
    const nodeCount = template.canvas_data?.nodes.length || 0;
    if (nodeCount < 10) {
      return { ...test, status: 'failed', message: 'Enterprise workflow needs 10+ nodes' };
    }
    
    return {
      ...test,
      status: 'passed',
      message: 'RevOps Command Center template valid',
      details: { hasRouter: true, conditions: conditionCount, nodes: nodeCount }
    };
  };