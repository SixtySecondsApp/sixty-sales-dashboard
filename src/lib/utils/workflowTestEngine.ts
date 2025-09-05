// Workflow Test Engine for visual testing and debugging
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  testData: Record<string, any>;
}

export interface NodeExecutionState {
  status: 'idle' | 'active' | 'success' | 'failed' | 'skipped' | 'waiting';
  executionTime?: number;
  startTime?: number;
  error?: string;
  outputData?: any;
  inputData?: any;
}

export interface ExecutionLog {
  timestamp: number;
  nodeId: string;
  nodeName: string;
  type: 'start' | 'complete' | 'error' | 'condition' | 'data';
  message: string;
  data?: any;
  success?: boolean;
}

export interface TestExecutionState {
  isRunning: boolean;
  isPaused: boolean;
  currentNodeId: string | null;
  nodeStates: Map<string, NodeExecutionState>;
  executionPath: string[];
  testData: any;
  executionSpeed: number; // 0.5x, 1x, 2x, 5x
  logs: ExecutionLog[];
  startTime?: number;
  endTime?: number;
}

export class WorkflowTestEngine {
  private onStateChange: (state: TestExecutionState) => void;
  private state: TestExecutionState;
  private nodes: any[];
  private edges: any[];
  private abortController?: AbortController;

  constructor(
    nodes: any[], 
    edges: any[], 
    onStateChange: (state: TestExecutionState) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.onStateChange = onStateChange;
    this.state = {
      isRunning: false,
      isPaused: false,
      currentNodeId: null,
      nodeStates: new Map(),
      executionPath: [],
      testData: {},
      executionSpeed: 1,
      logs: []
    };

    // Initialize all nodes as idle
    nodes.forEach(node => {
      this.state.nodeStates.set(node.id, { status: 'idle' });
    });
  }

  // Generate test data based on trigger type and scenario
  generateTestData(triggerType: string, scenario?: string): any {
    const baseData = {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    switch (triggerType) {
      case 'deal_created':
        return {
          ...baseData,
          deal_id: 'test_deal_123',
          deal_name: scenario === 'high_value' ? 'Enterprise Deal - Acme Corp' : 'Standard Deal - Test Co',
          value: scenario === 'high_value' ? 150000 : 25000,
          stage: 'SQL',
          company: 'Test Company',
          contact_name: 'John Doe',
          contact_email: 'john@example.com',
          owner: 'current_user'
        };

      case 'stage_changed':
        return {
          ...baseData,
          deal_id: 'test_deal_456',
          deal_name: 'Pipeline Test Deal',
          old_stage: 'SQL',
          new_stage: scenario === 'to_opportunity' ? 'Opportunity' : 'Verbal',
          value: 50000
        };

      case 'activity_monitor':
        return {
          ...baseData,
          deal_id: 'test_deal_789',
          deal_name: 'Activity Monitor Test',
          days_inactive: scenario === 'no_activity' ? 14 : 3,
          last_activity: '2024-01-01',
          activity_count: scenario === 'no_activity' ? 0 : 2
        };

      case 'task_overdue':
        return {
          ...baseData,
          task_id: 'test_task_001',
          task_title: 'Follow up with client',
          days_overdue: scenario === 'urgent' ? 7 : 1,
          assigned_to: 'current_user',
          deal_name: 'Overdue Task Deal'
        };

      case 'webhook_received':
        return {
          ...baseData,
          webhook_data: {
            source: 'external_system',
            event: 'data_updated',
            payload: { id: 123, status: 'active' }
          }
        };

      default:
        return {
          ...baseData,
          trigger_type: triggerType
        };
    }
  }

  // Start test execution
  async startTest(scenario?: TestScenario) {
    if (this.state.isRunning) return;

    this.abortController = new AbortController();
    
    // Find trigger node
    const triggerNode = this.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      this.addLog('error', 'no_trigger', 'No Trigger', 'No trigger node found in workflow');
      return;
    }

    // Generate test data
    const testData = scenario?.testData || 
      this.generateTestData(triggerNode.data.type, scenario?.id);

    // Initialize state
    this.state = {
      ...this.state,
      isRunning: true,
      isPaused: false,
      currentNodeId: triggerNode.id,
      executionPath: [],
      testData,
      startTime: Date.now(),
      logs: []
    };

    this.addLog('start', triggerNode.id, triggerNode.data.label, `Test started with scenario: ${scenario?.name || 'Default'}`);
    this.updateState();

    // Start execution from trigger
    await this.executeNode(triggerNode);
    
    // Mark test as complete
    this.state.isRunning = false;
    this.state.currentNodeId = null;
    this.state.endTime = Date.now();
    this.addLog('complete', 'test', 'Test', `Test completed in ${this.state.endTime - this.state.startTime!}ms`);
    this.updateState();
  }

  // Execute a single node
  private async executeNode(node: any) {
    if (this.abortController?.signal.aborted) return;
    
    // Wait if paused
    while (this.state.isPaused && !this.abortController?.signal.aborted) {
      await this.delay(100);
    }

    // Update node state to active
    this.updateNodeState(node.id, { status: 'active', startTime: Date.now() });
    this.state.currentNodeId = node.id;
    this.state.executionPath.push(node.id);
    this.updateState();

    // Add execution delay for visual effect
    await this.delay(1000 / this.state.executionSpeed);

    try {
      // Execute based on node type
      let result: any;
      let nextNodes: any[] = [];

      switch (node.type) {
        case 'trigger':
          result = await this.executeTrigger(node);
          nextNodes = this.getNextNodes(node.id);
          break;

        case 'condition':
          const conditionMet = await this.evaluateCondition(node);
          result = { conditionMet };
          
          // Find the appropriate edge based on condition result
          const edges = this.edges.filter(e => e.source === node.id);
          edges.forEach(edge => {
            // Assuming edges have sourceHandle 'true'/'false' for conditions
            if ((conditionMet && edge.sourceHandle === 'true') || 
                (!conditionMet && edge.sourceHandle === 'false')) {
              const nextNode = this.nodes.find(n => n.id === edge.target);
              if (nextNode) nextNodes.push(nextNode);
            }
          });
          
          // If no labeled edges, just take the next node
          if (nextNodes.length === 0) {
            nextNodes = conditionMet ? this.getNextNodes(node.id) : [];
          }
          break;

        case 'router':
          result = await this.executeRouter(node);
          // Router sends to all connected nodes
          nextNodes = this.getNextNodes(node.id);
          break;

        case 'action':
          result = await this.executeAction(node);
          nextNodes = this.getNextNodes(node.id);
          break;

        default:
          result = { success: true };
          nextNodes = this.getNextNodes(node.id);
      }

      // Mark node as successful
      const executionTime = Date.now() - (this.state.nodeStates.get(node.id)?.startTime || Date.now());
      this.updateNodeState(node.id, { 
        status: 'success', 
        executionTime,
        outputData: result 
      });
      
      this.addLog('complete', node.id, node.data.label, 
        `Completed in ${executionTime}ms`, result, true);

      // Execute next nodes
      for (const nextNode of nextNodes) {
        if (!this.state.executionPath.includes(nextNode.id)) {
          await this.executeNode(nextNode);
        }
      }

    } catch (error) {
      // Mark node as failed
      this.updateNodeState(node.id, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      this.addLog('error', node.id, node.data.label, 
        error instanceof Error ? error.message : 'Execution failed', null, false);
    }
  }

  // Execute trigger node
  private async executeTrigger(node: any) {
    this.addLog('data', node.id, node.data.label, 
      'Trigger activated with test data', this.state.testData);
    return { triggered: true, data: this.state.testData };
  }

  // Evaluate condition node
  private async evaluateCondition(node: any): Promise<boolean> {
    const { testData } = this.state;
    const conditionType = node.data.conditionType;
    
    let result = false;
    let message = '';

    switch (conditionType) {
      case 'value_check':
        const value = testData.value || 0;
        const threshold = node.data.threshold || 50000;
        const operator = node.data.operator || '>';
        
        switch (operator) {
          case '>': result = value > threshold; break;
          case '<': result = value < threshold; break;
          case '>=': result = value >= threshold; break;
          case '<=': result = value <= threshold; break;
          case '=': result = value === threshold; break;
        }
        message = `Value ${value} ${operator} ${threshold} = ${result}`;
        break;

      case 'stage_check':
        const stage = testData.stage || testData.new_stage;
        const targetStage = node.data.stage;
        result = stage === targetStage;
        message = `Stage "${stage}" === "${targetStage}" = ${result}`;
        break;

      case 'custom_field':
        const fieldName = node.data.customFieldName;
        const fieldValue = testData[fieldName];
        const expectedValue = node.data.customFieldValue;
        const fieldOperator = node.data.customFieldOperator || 'equals';
        
        switch (fieldOperator) {
          case 'equals': result = fieldValue === expectedValue; break;
          case 'not_equals': result = fieldValue !== expectedValue; break;
          case 'contains': result = fieldValue?.includes(expectedValue); break;
          case 'is_empty': result = !fieldValue; break;
          case 'is_not_empty': result = !!fieldValue; break;
        }
        message = `Field "${fieldName}" ${fieldOperator} "${expectedValue}" = ${result}`;
        break;

      default:
        // Default to true for testing
        result = Math.random() > 0.5;
        message = `Random condition = ${result}`;
    }

    this.addLog('condition', node.id, node.data.label, message, { result });
    return result;
  }

  // Execute router node
  private async executeRouter(node: any) {
    const routingLogic = node.data.routingLogic || 'all';
    this.addLog('data', node.id, node.data.label, 
      `Routing with logic: ${routingLogic}`);
    return { routed: true, logic: routingLogic };
  }

  // Execute action node
  private async executeAction(node: any) {
    const actionType = node.data.type || node.data.actionType;
    let result: any = { success: true };
    
    switch (actionType) {
      case 'create_task':
        result = {
          ...result,
          task_created: true,
          task_id: `task_${Date.now()}`,
          task_title: this.interpolateVariables(node.data.taskTitle || 'Test Task')
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Created task "${result.task_title}"`, result);
        break;

      case 'send_slack':
        result = {
          ...result,
          slack_sent: true,
          channel: node.data.slackChannel || '#general',
          message: this.interpolateVariables(node.data.slackMessage || 'Test message')
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Sent Slack message to ${result.channel}`, result);
        break;

      case 'send_email':
        result = {
          ...result,
          email_sent: true,
          to: node.data.emailTo || 'test@example.com',
          subject: this.interpolateVariables(node.data.emailSubject || 'Test Email')
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Sent email to ${result.to}`, result);
        break;

      case 'update_fields':
        const updates = node.data.fieldUpdates || [];
        result = {
          ...result,
          fields_updated: true,
          updates: updates.map((u: any) => ({
            field: u.field,
            value: this.interpolateVariables(u.value)
          }))
        };
        // Apply updates to test data
        updates.forEach((update: any) => {
          if (update.field) {
            this.state.testData[update.field] = this.interpolateVariables(update.value);
          }
        });
        this.addLog('data', node.id, node.data.label, 
          `Mock: Updated ${updates.length} fields`, result);
        break;

      case 'add_note':
        result = {
          ...result,
          note_added: true,
          content: this.interpolateVariables(node.data.noteContent || 'Test note')
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Added note`, result);
        break;

      case 'create_recurring_task':
        result = {
          ...result,
          recurring_task_created: true,
          pattern: node.data.recurrencePattern || 'weekly',
          occurrences: node.data.occurrences || 10
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Created recurring task (${result.pattern}, ${result.occurrences} times)`, result);
        break;

      case 'send_webhook':
        result = {
          ...result,
          webhook_sent: true,
          url: node.data.webhookUrl || 'https://example.com/webhook',
          method: node.data.httpMethod || 'POST'
        };
        this.addLog('data', node.id, node.data.label, 
          `Mock: Sent ${result.method} webhook to ${result.url}`, result);
        break;

      default:
        this.addLog('data', node.id, node.data.label, 
          `Mock: Executed action type "${actionType}"`);
    }

    return result;
  }

  // Get next nodes connected to current node
  private getNextNodes(nodeId: string): any[] {
    const connectedEdges = this.edges.filter(e => e.source === nodeId);
    return connectedEdges
      .map(edge => this.nodes.find(n => n.id === edge.target))
      .filter(Boolean);
  }

  // Interpolate variables in strings
  private interpolateVariables(text: string): string {
    if (!text) return '';
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return this.state.testData[variable] || match;
    });
  }

  // Update node execution state
  private updateNodeState(nodeId: string, state: Partial<NodeExecutionState>) {
    const currentState = this.state.nodeStates.get(nodeId) || { status: 'idle' };
    this.state.nodeStates.set(nodeId, { ...currentState, ...state });
  }

  // Add log entry
  private addLog(
    type: ExecutionLog['type'], 
    nodeId: string, 
    nodeName: string, 
    message: string, 
    data?: any, 
    success?: boolean
  ) {
    this.state.logs.push({
      timestamp: Date.now(),
      nodeId,
      nodeName,
      type,
      message,
      data,
      success
    });
  }

  // Update state and notify listeners
  private updateState() {
    this.onStateChange({ ...this.state });
  }

  // Helper to add delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Control methods
  pause() {
    this.state.isPaused = true;
    this.updateState();
  }

  resume() {
    this.state.isPaused = false;
    this.updateState();
  }

  stop() {
    this.abortController?.abort();
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.currentNodeId = null;
    
    // Mark any active nodes as idle
    this.state.nodeStates.forEach((state, nodeId) => {
      if (state.status === 'active' || state.status === 'waiting') {
        this.updateNodeState(nodeId, { status: 'idle' });
      }
    });
    
    this.updateState();
  }

  setSpeed(speed: number) {
    this.state.executionSpeed = speed;
    this.updateState();
  }

  reset() {
    this.state = {
      isRunning: false,
      isPaused: false,
      currentNodeId: null,
      nodeStates: new Map(),
      executionPath: [],
      testData: {},
      executionSpeed: 1,
      logs: []
    };
    
    this.nodes.forEach(node => {
      this.state.nodeStates.set(node.id, { status: 'idle' });
    });
    
    this.updateState();
  }
}

// Predefined test scenarios
export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'high_value_deal',
    name: 'High Value Deal ($150k)',
    description: 'Test with a high-value enterprise deal',
    triggerType: 'deal_created',
    testData: {}
  },
  {
    id: 'low_value_deal',
    name: 'Standard Deal ($25k)',
    description: 'Test with a standard value deal',
    triggerType: 'deal_created',
    testData: {}
  },
  {
    id: 'no_activity',
    name: 'No Activity (14 days)',
    description: 'Test with a deal that has no recent activity',
    triggerType: 'activity_monitor',
    testData: {}
  },
  {
    id: 'to_opportunity',
    name: 'Move to Opportunity',
    description: 'Test stage change to Opportunity',
    triggerType: 'stage_changed',
    testData: {}
  },
  {
    id: 'urgent_overdue',
    name: 'Urgent Task Overdue',
    description: 'Test with a task overdue by 7 days',
    triggerType: 'task_overdue',
    testData: {}
  }
];