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

      // Mark node as successful or skipped based on condition result
      const executionTime = Date.now() - (this.state.nodeStates.get(node.id)?.startTime || Date.now());
      
      // For condition nodes, mark as success/failed based on the condition result
      let nodeStatus = 'success';
      if (node.type === 'condition') {
        // Condition node itself is successful if it evaluated without error
        // But we log whether the condition passed or failed
        const conditionPassed = result.conditionMet;
        nodeStatus = 'success'; // The node executed successfully
        this.addLog('condition', node.id, node.data.label, 
          `Condition ${conditionPassed ? 'PASSED' : 'FAILED'}`, result, conditionPassed);
      }
      
      this.updateNodeState(node.id, { 
        status: nodeStatus, 
        executionTime,
        outputData: result 
      });
      
      if (node.type !== 'condition') {
        this.addLog('complete', node.id, node.data.label, 
          `Completed in ${executionTime}ms`, result, true);
      }
      
      // Update state to notify listeners of progress
      this.updateState();

      // Execute next nodes (will be empty if condition failed and no false branch)
      for (const nextNode of nextNodes) {
        if (!this.state.executionPath.includes(nextNode.id)) {
          await this.executeNode(nextNode);
        }
      }
      
      // Mark any unreachable nodes as skipped if this was a failed condition
      if (node.type === 'condition' && !result.conditionMet && nextNodes.length === 0) {
        // Find all nodes that would have been executed if condition passed
        const skippedNodes = this.getNextNodes(node.id);
        for (const skippedNode of skippedNodes) {
          if (!this.state.executionPath.includes(skippedNode.id)) {
            this.updateNodeState(skippedNode.id, { status: 'skipped' });
            this.addLog('skip', skippedNode.id, skippedNode.data.label, 
              'Skipped due to failed condition');
            
            // Recursively mark downstream nodes as skipped
            const downstreamNodes = this.getNextNodes(skippedNode.id);
            for (const downstream of downstreamNodes) {
              if (!this.state.executionPath.includes(downstream.id)) {
                this.updateNodeState(downstream.id, { status: 'skipped' });
                this.addLog('skip', downstream.id, downstream.data.label, 
                  'Skipped due to failed condition');
              }
            }
          }
        }
        this.updateState();
      }

    } catch (error) {
      // Mark node as failed
      this.updateNodeState(node.id, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      this.addLog('error', node.id, node.data.label, 
        error instanceof Error ? error.message : 'Execution failed', null, false);
      
      // Update state to notify listeners of progress
      this.updateState();
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
    const conditionType = node.data.conditionType || node.data.type;
    
    // Check if there's a raw condition string (e.g., "deal_value > 10000")
    const rawCondition = node.data.condition;
    
    let result = false;
    let message = '';
    
    // Handle raw condition strings like "deal_value > 10000"
    if (rawCondition && typeof rawCondition === 'string') {
      // Parse conditions like "deal_value > 10000" or "activity_type == 'proposal_sent'"
      const conditionMatch = rawCondition.match(/(\w+)\s*([><=!]+)\s*(.+)/);
      if (conditionMatch) {
        const [, field, operator, expectedValue] = conditionMatch;
        const actualValue = testData[field];
        const expected = expectedValue.replace(/['"]/g, ''); // Remove quotes if present
        const expectedNum = parseFloat(expected);
        
        console.log('Raw condition evaluation:', { field, operator, actualValue, expected, testData });
        
        switch (operator) {
          case '>':
            result = parseFloat(actualValue) > expectedNum;
            break;
          case '<':
            result = parseFloat(actualValue) < expectedNum;
            break;
          case '>=':
            result = parseFloat(actualValue) >= expectedNum;
            break;
          case '<=':
            result = parseFloat(actualValue) <= expectedNum;
            break;
          case '==':
          case '===':
            result = actualValue == expected;
            break;
          case '!=':
          case '!==':
            result = actualValue != expected;
            break;
          default:
            result = false;
        }
        
        message = `${field} ${operator} ${expected} = ${result} (actual: ${actualValue})`;
        this.addLog('condition', node.id, node.data.label, message, { result });
        return result;
      }
    }

    switch (conditionType) {
      case 'value_check':
      case 'value_greater_than':
        const value = testData.value || 0;
        const threshold = node.data.threshold || node.data.value || 50000;
        const operator = node.data.operator || '>';
        
        switch (operator) {
          case '>': result = value > threshold; break;
          case '<': result = value < threshold; break;
          case '>=': result = value >= threshold; break;
          case '<=': result = value <= threshold; break;
          case '=': result = value === threshold; break;
          case '==': result = value === threshold; break;
        }
        message = `Value ${value} ${operator} ${threshold} = ${result}`;
        break;

      case 'stage_check':
        const stage = testData.stage || testData.new_stage;
        const targetStage = node.data.stage || node.data.value;
        result = stage === targetStage;
        message = `Stage "${stage}" === "${targetStage}" = ${result}`;
        break;

      case 'activity_type':
        // Handle activity type checks (used in Smart Proposal Follow-up)
        const activityType = testData.activity_type;
        const expectedType = node.data.activityType || node.data.value || 'proposal_sent';
        result = activityType === expectedType;
        message = `Activity type "${activityType}" === "${expectedType}" = ${result}`;
        console.log('Activity type check:', { activityType, expectedType, result, nodeData: node.data });
        break;

      case 'custom_field':
        const fieldName = node.data.customFieldName || node.data.field;
        const fieldValue = testData[fieldName];
        const expectedValue = node.data.customFieldValue || node.data.value;
        const fieldOperator = node.data.customFieldOperator || node.data.operator || 'equals';
        
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
        // Check if the condition type is actually the field name itself
        if (conditionType === 'activity_type' || node.data.field === 'activity_type') {
          const activityType = testData.activity_type;
          const expectedType = node.data.value || 'proposal_sent';
          result = activityType === expectedType;
          message = `Activity type "${activityType}" === "${expectedType}" = ${result}`;
          console.log('Default activity type check:', { activityType, expectedType, result, nodeData: node.data });
        } else if (node.data.field && node.data.value !== undefined) {
          const fieldName = node.data.field;
          const fieldValue = testData[fieldName];
          const expectedValue = node.data.value;
          result = fieldValue === expectedValue;
          message = `Field "${fieldName}" === "${expectedValue}" = ${result} (actual: "${fieldValue}")`;
        } else {
          // Default to checking if the node has any specific condition data
          console.log('Unknown condition, defaulting to pass:', { conditionType, nodeData: node.data });
          result = true; // Default to passing for unknown conditions
          message = `Unknown condition type "${conditionType}" - defaulting to pass`;
        }
    }

    this.addLog('condition', node.id, node.data.label, message, { 
      result, 
      conditionType,
      nodeData: node.data,
      testData 
    });
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