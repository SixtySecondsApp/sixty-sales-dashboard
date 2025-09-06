/**
 * Workflow Test Scenario Generator
 * Automatically generates test scenarios for workflows based on their configuration
 */

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  testData: any;
  expectedOutcome: 'pass' | 'fail' | 'partial';
  category: 'pass' | 'fail' | 'edge';
}

export class WorkflowTestGenerator {
  /**
   * Generate test scenarios for a workflow
   */
  static generateTestScenarios(workflow: any): TestScenario[] {
    const scenarios: TestScenario[] = [];
    
    if (!workflow?.canvas_data?.nodes) {
      return scenarios;
    }
    
    const nodes = workflow.canvas_data.nodes;
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    const conditionNodes = nodes.filter((n: any) => n.type === 'condition');
    const actionNodes = nodes.filter((n: any) => n.type === 'action');
    
    if (!triggerNode) {
      return scenarios;
    }
    
    const triggerType = triggerNode.data.triggerType || triggerNode.data.type;
    const triggerLabel = triggerNode.data.label || 'Trigger';
    
    // Generate scenarios based on conditions
    if (conditionNodes.length > 0) {
      // Generate pass/fail scenarios for each condition
      conditionNodes.forEach((conditionNode: any, index: number) => {
        const conditionData = this.parseConditionNode(conditionNode);
        
        // Pass scenario
        scenarios.push({
          id: `pass_condition_${index}`,
          name: `${triggerLabel} - Pass ${conditionNode.data.label || 'Condition'}`,
          description: `Test with data that should pass the ${conditionNode.data.label || 'condition'}`,
          testData: this.generateTestDataForCondition(triggerType, conditionData, true),
          expectedOutcome: 'pass',
          category: 'pass'
        });
        
        // Fail scenario
        scenarios.push({
          id: `fail_condition_${index}`,
          name: `${triggerLabel} - Fail ${conditionNode.data.label || 'Condition'}`,
          description: `Test with data that should fail the ${conditionNode.data.label || 'condition'}`,
          testData: this.generateTestDataForCondition(triggerType, conditionData, false),
          expectedOutcome: 'fail',
          category: 'fail'
        });
      });
      
      // Combined scenario - pass all conditions
      if (conditionNodes.length > 1) {
        scenarios.push({
          id: 'pass_all_conditions',
          name: `${triggerLabel} - Pass All Conditions`,
          description: 'Test with data that should pass all conditions',
          testData: this.generateTestDataForAllConditions(triggerType, conditionNodes, true),
          expectedOutcome: 'pass',
          category: 'pass'
        });
      }
    } else {
      // No conditions - just basic flow test
      scenarios.push({
        id: 'basic_flow',
        name: `${triggerLabel} - Basic Flow`,
        description: `Test the workflow with typical ${triggerLabel.toLowerCase()} data`,
        testData: this.generateBasicTestData(triggerType),
        expectedOutcome: 'pass',
        category: 'pass'
      });
    }
    
    // Edge cases
    scenarios.push({
      id: 'edge_missing_fields',
      name: `${triggerLabel} - Missing Fields`,
      description: 'Test with missing required fields',
      testData: this.generateEdgeCaseData(triggerType, 'missing_fields'),
      expectedOutcome: 'fail',
      category: 'edge'
    });
    
    scenarios.push({
      id: 'edge_invalid_data',
      name: `${triggerLabel} - Invalid Data`,
      description: 'Test with invalid data types',
      testData: this.generateEdgeCaseData(triggerType, 'invalid_data'),
      expectedOutcome: 'fail',
      category: 'edge'
    });
    
    scenarios.push({
      id: 'edge_boundary_values',
      name: `${triggerLabel} - Boundary Values`,
      description: 'Test with boundary values (0, negative, very large)',
      testData: this.generateEdgeCaseData(triggerType, 'boundary_values'),
      expectedOutcome: 'partial',
      category: 'edge'
    });
    
    return scenarios;
  }
  
  /**
   * Parse condition node to extract condition details
   */
  private static parseConditionNode(conditionNode: any): any {
    const data = conditionNode.data;
    
    // Check for raw condition string (e.g., "deal_value > 10000")
    if (data.condition && typeof data.condition === 'string') {
      const match = data.condition.match(/(\w+)\s*([><=!]+)\s*(.+)/);
      if (match) {
        return {
          field: match[1],
          operator: match[2],
          value: match[3].replace(/['"]/g, ''),
          type: 'raw_condition'
        };
      }
    }
    
    // Standard condition properties
    return {
      field: data.field || data.conditionType || 'unknown',
      operator: data.operator || '==',
      value: data.value || data.threshold || data.expectedValue || null,
      type: data.conditionType || data.type || 'unknown'
    };
  }
  
  /**
   * Generate test data for a specific condition
   */
  private static generateTestDataForCondition(
    triggerType: string,
    conditionData: any,
    shouldPass: boolean
  ): any {
    const baseData = {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      test_type: shouldPass ? 'pass' : 'fail'
    };
    
    // Handle different field types
    switch (conditionData.field) {
      case 'deal_value':
      case 'value':
        const threshold = parseFloat(conditionData.value) || 10000;
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          deal_value: this.calculateValueForOperator(threshold, conditionData.operator, shouldPass),
          value: this.calculateValueForOperator(threshold, conditionData.operator, shouldPass)
        };
        
      case 'activity_type':
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          activity_type: shouldPass ? conditionData.value : 'other_activity'
        };
        
      case 'stage':
      case 'new_stage':
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          old_stage: 'Previous Stage',
          new_stage: shouldPass ? conditionData.value : 'Different Stage',
          stage: shouldPass ? conditionData.value : 'Different Stage'
        };
        
      case 'priority':
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          priority: shouldPass ? conditionData.value : 'low'
        };
        
      case 'days_inactive':
        const inactiveDays = parseInt(conditionData.value) || 7;
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          days_inactive: this.calculateValueForOperator(inactiveDays, conditionData.operator, shouldPass),
          last_activity: new Date(Date.now() - (shouldPass ? inactiveDays + 1 : inactiveDays - 1) * 24 * 60 * 60 * 1000).toISOString()
        };
        
      default:
        // Generic field handling
        return {
          ...baseData,
          ...this.getBaseTriggerData(triggerType),
          [conditionData.field]: shouldPass ? conditionData.value : `not_${conditionData.value}`
        };
    }
  }
  
  /**
   * Calculate value based on operator and pass/fail requirement
   */
  private static calculateValueForOperator(
    threshold: number,
    operator: string,
    shouldPass: boolean
  ): number {
    switch (operator) {
      case '>':
        return shouldPass ? threshold + 1000 : threshold - 1000;
      case '>=':
        return shouldPass ? threshold : threshold - 1;
      case '<':
        return shouldPass ? threshold - 1000 : threshold + 1000;
      case '<=':
        return shouldPass ? threshold : threshold + 1;
      case '==':
      case '===':
        return shouldPass ? threshold : threshold + 1;
      case '!=':
      case '!==':
        return shouldPass ? threshold + 1 : threshold;
      default:
        return shouldPass ? threshold : threshold - 1000;
    }
  }
  
  /**
   * Get base trigger data for different trigger types
   */
  private static getBaseTriggerData(triggerType: string): any {
    switch (triggerType) {
      case 'deal_created':
        return {
          deal_id: 'test_deal_' + Date.now(),
          deal_name: 'Test Deal',
          company: 'Test Company',
          contact_name: 'John Doe',
          contact_email: 'john@example.com',
          stage: 'SQL',
          value: 50000
        };
        
      case 'stage_changed':
        return {
          deal_id: 'test_deal_' + Date.now(),
          deal_name: 'Pipeline Test Deal',
          company: 'Test Company',
          old_stage: 'SQL',
          new_stage: 'Opportunity',
          value: 25000
        };
        
      case 'activity_created':
        return {
          activity_id: 'test_activity_' + Date.now(),
          activity_type: 'call',
          description: 'Test activity',
          deal_id: 'test_deal_123',
          deal_name: 'Test Deal',
          company: 'Test Company',
          contact_name: 'Jane Smith'
        };
        
      case 'task_completed':
        return {
          task_id: 'test_task_' + Date.now(),
          task_title: 'Test Task',
          completed: true,
          assigned_to: 'test_user',
          priority: 'medium',
          deal_id: 'test_deal_123'
        };
        
      case 'activity_monitor':
        return {
          deal_id: 'test_deal_' + Date.now(),
          deal_name: 'Monitored Deal',
          days_inactive: 5,
          last_activity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          activity_count: 2
        };
        
      default:
        return {
          id: 'test_' + Date.now(),
          name: 'Test Entity',
          type: triggerType
        };
    }
  }
  
  /**
   * Generate test data that should pass all conditions
   */
  private static generateTestDataForAllConditions(
    triggerType: string,
    conditionNodes: any[],
    shouldPass: boolean
  ): any {
    let testData = {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...this.getBaseTriggerData(triggerType)
    };
    
    // Merge data for all conditions
    conditionNodes.forEach(node => {
      const conditionData = this.parseConditionNode(node);
      const conditionTestData = this.generateTestDataForCondition(triggerType, conditionData, shouldPass);
      testData = { ...testData, ...conditionTestData };
    });
    
    return testData;
  }
  
  /**
   * Generate basic test data for workflows without conditions
   */
  private static generateBasicTestData(triggerType: string): any {
    return {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...this.getBaseTriggerData(triggerType)
    };
  }
  
  /**
   * Generate edge case test data
   */
  private static generateEdgeCaseData(triggerType: string, edgeType: string): any {
    const baseData = this.getBaseTriggerData(triggerType);
    
    switch (edgeType) {
      case 'missing_fields':
        // Remove some required fields
        const { deal_name, company, ...missingFieldsData } = baseData;
        return {
          test_run_id: `test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...missingFieldsData
        };
        
      case 'invalid_data':
        return {
          test_run_id: `test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...baseData,
          value: 'not_a_number', // Invalid number
          stage: 123, // Invalid string
          deal_id: null,
          contact_email: 'invalid-email'
        };
        
      case 'boundary_values':
        return {
          test_run_id: `test_${Date.now()}`,
          timestamp: new Date().toISOString(),
          ...baseData,
          value: 0,
          days_inactive: -1,
          activity_count: 999999,
          deal_name: '', // Empty string
          priority: 'ultra_high' // Unexpected value
        };
        
      default:
        return {
          test_run_id: `test_${Date.now()}`,
          timestamp: new Date().toISOString()
        };
    }
  }
  
  /**
   * Save test scenarios with the workflow
   */
  static async saveTestScenarios(workflowId: string, scenarios: TestScenario[]): Promise<void> {
    // In a real implementation, this would save to a database
    // For now, we'll store in localStorage or session storage
    const key = `workflow_tests_${workflowId}`;
    localStorage.setItem(key, JSON.stringify(scenarios));
  }
  
  /**
   * Load test scenarios for a workflow
   */
  static async loadTestScenarios(workflowId: string): Promise<TestScenario[]> {
    const key = `workflow_tests_${workflowId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }
}