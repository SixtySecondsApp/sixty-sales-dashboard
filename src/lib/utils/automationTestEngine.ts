/**
 * Automation Test Engine
 * 
 * Comprehensive testing system for automation rules without HITL dependencies.
 * Provides validation, simulation, and performance testing capabilities.
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  fromStage?: string;
  toStage: string;
  isEnabled: boolean;
  executionOrder: number;
  conditions?: Record<string, any>;
  actions: AutomationAction[];
}

export interface AutomationAction {
  type: 'create_activity' | 'create_task' | 'send_notification' | 'update_field';
  config: Record<string, any>;
}

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  dealData: {
    id?: string;
    name: string;
    currentStage: string;
    targetStage: string;
    value?: number;
    ownerId?: string;
  };
  expectedActions: AutomationAction[];
  mockData?: Record<string, any>;
}

export interface TestResult {
  scenarioId: string;
  scenarioName: string;
  success: boolean;
  executionTime: number;
  triggeredRules: string[];
  executedActions: AutomationAction[];
  errors: string[];
  warnings: string[];
  performance: {
    ruleEvaluationTime: number;
    actionExecutionTime: number;
    totalTime: number;
  };
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  scenarios: TestScenario[];
  createdAt: string;
  updatedAt: string;
}

export class AutomationTestEngine {
  private static instance: AutomationTestEngine;
  private testResults: Map<string, TestResult[]> = new Map();

  public static getInstance(): AutomationTestEngine {
    if (!AutomationTestEngine.instance) {
      AutomationTestEngine.instance = new AutomationTestEngine();
    }
    return AutomationTestEngine.instance;
  }

  /**
   * Execute a comprehensive test suite for automation rules
   */
  async runTestSuite(suiteId: string): Promise<TestResult[]> {
    const startTime = Date.now();
    try {
      const suite = await this.loadTestSuite(suiteId);
      if (!suite) {
        throw new Error(`Test suite not found: ${suiteId}`);
      }

      const results: TestResult[] = [];
      
      // Load all automation rules
      const rules = await this.loadAutomationRules();
      
      // Execute each test scenario
      for (const scenario of suite.scenarios) {
        const result = await this.executeTestScenario(scenario, rules);
        results.push(result);
      }
      
      // Store results
      this.testResults.set(suiteId, results);
      
      const executionTime = Date.now() - startTime;
      // Generate test report
      this.generateTestReport(suite, results);
      
      return results;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute a single test scenario
   */
  private async executeTestScenario(
    scenario: TestScenario,
    rules: AutomationRule[]
  ): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      success: false,
      executionTime: 0,
      triggeredRules: [],
      executedActions: [],
      errors: [],
      warnings: [],
      performance: {
        ruleEvaluationTime: 0,
        actionExecutionTime: 0,
        totalTime: 0
      }
    };

    try {
      // Simulate deal stage transition
      const ruleEvalStart = Date.now();
      
      // Find matching rules
      const matchingRules = this.findMatchingRules(
        rules,
        scenario.dealData.currentStage,
        scenario.dealData.targetStage
      );
      
      result.performance.ruleEvaluationTime = Date.now() - ruleEvalStart;
      result.triggeredRules = matchingRules.map(rule => rule.id);
      
      // Execute actions for each matching rule
      const actionExecStart = Date.now();
      
      for (const rule of matchingRules) {
        if (!rule.isEnabled) continue;
        
        for (const action of rule.actions) {
          try {
            const validationResult = this.validateAction(action, scenario);
            if (validationResult.isValid) {
              result.executedActions.push(action);
            } else {
              result.warnings.push(...validationResult.warnings);
            }
          } catch (error) {
            result.errors.push(`Action validation failed: ${error}`);
          }
        }
      }
      
      result.performance.actionExecutionTime = Date.now() - actionExecStart;
      result.performance.totalTime = Date.now() - startTime;
      result.executionTime = result.performance.totalTime;
      
      // Validate expected outcomes
      result.success = this.validateExpectedOutcome(result, scenario);
      
      if (!result.success) {
        result.errors.push('Test scenario did not meet expected outcomes');
      }
      
    } catch (error) {
      result.errors.push(`Scenario execution failed: ${error}`);
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Find automation rules that match the stage transition
   */
  private findMatchingRules(
    rules: AutomationRule[],
    fromStage: string,
    toStage: string
  ): AutomationRule[] {
    return rules.filter(rule => {
      // Check if rule matches the target stage
      if (rule.toStage !== toStage) return false;
      
      // Check if rule has a specific from stage requirement
      if (rule.fromStage && rule.fromStage !== fromStage) return false;
      
      return true;
    }).sort((a, b) => a.executionOrder - b.executionOrder);
  }

  /**
   * Validate an individual action
   */
  private validateAction(
    action: AutomationAction,
    scenario: TestScenario
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let isValid = true;

    switch (action.type) {
      case 'create_activity':
        if (!action.config.activityType) {
          warnings.push('Activity type is required');
          isValid = false;
        }
        if (!action.config.title) {
          warnings.push('Activity title is required');
          isValid = false;
        }
        break;

      case 'create_task':
        if (!action.config.title) {
          warnings.push('Task title is required');
          isValid = false;
        }
        if (action.config.dueInDays && action.config.dueInDays < 0) {
          warnings.push('Due date cannot be in the past');
          isValid = false;
        }
        break;

      case 'send_notification':
        if (!action.config.message) {
          warnings.push('Notification message is required');
          isValid = false;
        }
        if (!action.config.recipients || action.config.recipients.length === 0) {
          warnings.push('At least one recipient is required');
          isValid = false;
        }
        break;

      case 'update_field':
        if (!action.config.fieldName) {
          warnings.push('Field name is required');
          isValid = false;
        }
        if (action.config.fieldValue === undefined || action.config.fieldValue === '') {
          warnings.push('Field value is required');
          isValid = false;
        }
        break;

      default:
        warnings.push(`Unknown action type: ${action.type}`);
        isValid = false;
    }

    return { isValid, warnings };
  }

  /**
   * Validate that the test scenario produced expected outcomes
   */
  private validateExpectedOutcome(result: TestResult, scenario: TestScenario): boolean {
    // Check if expected actions were executed
    const expectedActionTypes = scenario.expectedActions.map(a => a.type);
    const executedActionTypes = result.executedActions.map(a => a.type);
    
    for (const expectedType of expectedActionTypes) {
      if (!executedActionTypes.includes(expectedType)) {
        result.errors.push(`Expected action type '${expectedType}' was not executed`);
        return false;
      }
    }
    
    // Check for critical errors
    if (result.errors.length > 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Load automation rules from database
   */
  private async loadAutomationRules(): Promise<AutomationRule[]> {
    try {
      const { data, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .order('execution_order', { ascending: true });

      if (error) throw error;

      return data?.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        fromStage: rule.from_stage,
        toStage: rule.to_stage,
        isEnabled: rule.is_enabled,
        executionOrder: rule.execution_order,
        conditions: rule.conditions || {},
        actions: rule.actions || []
      })) || [];
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load a test suite from storage or database
   */
  private async loadTestSuite(suiteId: string): Promise<TestSuite | null> {
    // For now, return predefined test suites
    // In a real implementation, these would be stored in database
    const predefinedSuites = this.getPredefinedTestSuites();
    return predefinedSuites.find(suite => suite.id === suiteId) || null;
  }

  /**
   * Generate a comprehensive test report
   */
  private generateTestReport(suite: TestSuite, results: TestResult[]): void {
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    const totalRulesTriggered = results.reduce((sum, r) => sum + r.triggeredRules.length, 0);
    const totalActionsExecuted = results.reduce((sum, r) => sum + r.executedActions.length, 0);
    // Show detailed results for failed tests
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      failedResults.forEach(result => {
        result.errors.forEach(error => undefined);
        result.warnings.forEach(warning => undefined);
      });
    }
  }

  /**
   * Get predefined test suites for automation testing
   */
  private getPredefinedTestSuites(): TestSuite[] {
    return [
      {
        id: 'basic-pipeline-transitions',
        name: 'Basic Pipeline Transitions',
        description: 'Test basic stage transition automation rules',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenarios: [
          {
            id: 'sql-to-opportunity',
            name: 'SQL to Opportunity Transition',
            description: 'Test automation when deal moves from SQL to Opportunity stage',
            dealData: {
              name: 'Test Deal 1',
              currentStage: 'sql',
              targetStage: 'opportunity',
              value: 10000,
              ownerId: 'test-user-1'
            },
            expectedActions: [
              {
                type: 'create_activity',
                config: { activityType: 'proposal', title: 'Send proposal' }
              }
            ]
          },
          {
            id: 'opportunity-to-verbal',
            name: 'Opportunity to Verbal Transition',
            description: 'Test automation when deal moves from Opportunity to Verbal stage',
            dealData: {
              name: 'Test Deal 2',
              currentStage: 'opportunity',
              targetStage: 'verbal',
              value: 25000,
              ownerId: 'test-user-2'
            },
            expectedActions: [
              {
                type: 'create_task',
                config: { title: 'Prepare contract', dueInDays: 2 }
              },
              {
                type: 'send_notification',
                config: { 
                  message: 'Deal moved to verbal - prepare contract',
                  recipients: ['deal_owner']
                }
              }
            ]
          },
          {
            id: 'verbal-to-signed',
            name: 'Verbal to Signed Transition',
            description: 'Test automation when deal is closed/signed',
            dealData: {
              name: 'Test Deal 3',
              currentStage: 'verbal',
              targetStage: 'signed',
              value: 50000,
              ownerId: 'test-user-3'
            },
            expectedActions: [
              {
                type: 'create_activity',
                config: { activityType: 'follow_up', title: 'Welcome client' }
              },
              {
                type: 'send_notification',
                config: {
                  message: 'Deal closed successfully!',
                  recipients: ['all_admins']
                }
              }
            ]
          }
        ]
      },
      {
        id: 'error-handling',
        name: 'Error Handling & Edge Cases',
        description: 'Test automation error handling and edge cases',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenarios: [
          {
            id: 'invalid-stage-transition',
            name: 'Invalid Stage Transition',
            description: 'Test handling of invalid stage transitions',
            dealData: {
              name: 'Invalid Transition Deal',
              currentStage: 'signed',
              targetStage: 'sql', // Invalid: moving backwards
              value: 1000,
            },
            expectedActions: [] // No actions should be triggered
          },
          {
            id: 'missing-deal-data',
            name: 'Missing Deal Data',
            description: 'Test handling of incomplete deal data',
            dealData: {
              name: '',
              currentStage: 'sql',
              targetStage: 'opportunity',
              // Missing value and owner
            },
            expectedActions: []
          }
        ]
      },
      {
        id: 'performance-testing',
        name: 'Performance Testing',
        description: 'Test automation performance with multiple rules and actions',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scenarios: [
          {
            id: 'bulk-stage-transitions',
            name: 'Bulk Stage Transitions',
            description: 'Test performance with multiple rapid stage transitions',
            dealData: {
              name: 'Bulk Test Deal',
              currentStage: 'sql',
              targetStage: 'opportunity',
              value: 15000,
            },
            expectedActions: [
              { type: 'create_activity', config: { activityType: 'proposal' } },
              { type: 'create_task', config: { title: 'Follow up' } },
              { type: 'send_notification', config: { message: 'Stage updated' } }
            ]
          }
        ]
      }
    ];
  }

  /**
   * Run performance benchmarks for automation system
   */
  async runPerformanceBenchmark(): Promise<{
    ruleEvaluationTime: number;
    actionExecutionTime: number;
    throughput: number;
    memoryUsage: number;
  }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage?.().heapUsed || 0;
    
    // Run basic pipeline transitions test suite multiple times
    const iterations = 10;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const testResults = await this.runTestSuite('basic-pipeline-transitions');
      results.push(testResults);
    }
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage?.().heapUsed || 0;
    
    // Calculate metrics
    const totalTime = endTime - startTime;
    const avgRuleEvalTime = results.flat().reduce((sum, r) => sum + r.performance.ruleEvaluationTime, 0) / results.flat().length;
    const avgActionExecTime = results.flat().reduce((sum, r) => sum + r.performance.actionExecutionTime, 0) / results.flat().length;
    const throughput = (results.flat().length * 1000) / totalTime; // tests per second
    const memoryUsage = endMemory - startMemory;
    
    return {
      ruleEvaluationTime: Math.round(avgRuleEvalTime),
      actionExecutionTime: Math.round(avgActionExecTime),
      throughput: Math.round(throughput * 100) / 100,
      memoryUsage: Math.round(memoryUsage / 1024 / 1024 * 100) / 100 // MB
    };
  }

  /**
   * Get test results for a specific suite
   */
  getTestResults(suiteId: string): TestResult[] | undefined {
    return this.testResults.get(suiteId);
  }

  /**
   * Clear all test results
   */
  clearTestResults(): void {
    this.testResults.clear();
  }
}

// Export singleton instance
export const automationTestEngine = AutomationTestEngine.getInstance();