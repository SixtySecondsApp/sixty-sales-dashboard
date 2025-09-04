/**
 * Unified Automation Engine
 * 
 * Comprehensive automation system supporting activity-created, stage-changed, 
 * deal-created, and task-completed triggers with full CRUD operations.
 * Based on the tested system from last night around 10pm.
 */

import { supabase } from '@/lib/supabase/clientV2';

// Core Types
export interface AutomationRule {
  id?: string;
  userId: string;
  ruleName: string;
  ruleDescription?: string;
  triggerType: 'activity_created' | 'stage_changed' | 'deal_created' | 'task_completed';
  triggerConditions: Record<string, any>;
  actionType: 'create_deal' | 'update_deal_stage' | 'create_task' | 'create_activity' | 'send_notification';
  actionConfig: Record<string, any>;
  isActive: boolean;
  executionOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationExecution {
  id?: string;
  ruleId: string;
  triggerData: Record<string, any>;
  executionResult?: Record<string, any>;
  status: 'success' | 'failed' | 'skipped' | 'test_mode';
  errorMessage?: string;
  executionTimeMs?: number;
  executedAt: string;
  executedBy: string;
  dealId?: string;
  activityId?: string;
  taskId?: string;
}

export interface AutomationTest {
  id?: string;
  ruleId: string;
  testScenario: Record<string, any>;
  expectedOutcome: Record<string, any>;
  actualOutcome?: Record<string, any>;
  testStatus: 'passed' | 'failed' | 'skipped' | 'pending';
  testNotes?: string;
  executedAt?: string;
  createdBy: string;
}

export class UnifiedAutomationEngine {
  private static instance: UnifiedAutomationEngine;

  public static getInstance(): UnifiedAutomationEngine {
    if (!UnifiedAutomationEngine.instance) {
      UnifiedAutomationEngine.instance = new UnifiedAutomationEngine();
    }
    return UnifiedAutomationEngine.instance;
  }

  /**
   * Create a new automation rule
   */
  async createRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutomationRule> {
    try {
      const { data, error } = await supabase
        .from('user_automation_rules')
        .insert([{
          user_id: rule.userId,
          rule_name: rule.ruleName,
          rule_description: rule.ruleDescription,
          trigger_type: rule.triggerType,
          trigger_conditions: rule.triggerConditions,
          action_type: rule.actionType,
          action_config: rule.actionConfig,
          is_active: rule.isActive,
          execution_order: rule.executionOrder
        }])
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Failed to create automation rule:', error);
      throw error;
    }
  }

  /**
   * Get all automation rules for a user
   */
  async getUserRules(userId: string): Promise<AutomationRule[]> {
    try {
      const { data, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .eq('user_id', userId)
        .order('execution_order', { ascending: true });

      if (error) throw error;

      return data?.map(this.mapFromDatabase) || [];
    } catch (error) {
      console.error('Failed to fetch automation rules:', error);
      return [];
    }
  }

  /**
   * Update an automation rule
   */
  async updateRule(id: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    try {
      const updateData: any = {};
      
      if (updates.ruleName) updateData.rule_name = updates.ruleName;
      if (updates.ruleDescription !== undefined) updateData.rule_description = updates.ruleDescription;
      if (updates.triggerType) updateData.trigger_type = updates.triggerType;
      if (updates.triggerConditions) updateData.trigger_conditions = updates.triggerConditions;
      if (updates.actionType) updateData.action_type = updates.actionType;
      if (updates.actionConfig) updateData.action_config = updates.actionConfig;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.executionOrder !== undefined) updateData.execution_order = updates.executionOrder;

      const { data, error } = await supabase
        .from('user_automation_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return this.mapFromDatabase(data);
    } catch (error) {
      console.error('Failed to update automation rule:', error);
      throw error;
    }
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete automation rule:', error);
      throw error;
    }
  }

  /**
   * Execute automation rules based on trigger
   */
  async executeAutomationRules(
    triggerType: AutomationRule['triggerType'],
    triggerData: Record<string, any>,
    userId: string
  ): Promise<AutomationExecution[]> {
    try {
      // Get matching rules
      const rules = await this.getMatchingRules(triggerType, triggerData, userId);
      const executions: AutomationExecution[] = [];

      for (const rule of rules) {
        if (!rule.isActive) continue;

        const startTime = Date.now();
        
        try {
          const result = await this.executeAction(rule, triggerData, userId);
          
          const execution: AutomationExecution = {
            ruleId: rule.id!,
            triggerData,
            executionResult: result,
            status: 'success',
            executionTimeMs: Date.now() - startTime,
            executedAt: new Date().toISOString(),
            executedBy: userId
          };

          // Log execution to database
          await this.logExecution(execution);
          executions.push(execution);

        } catch (error) {
          const execution: AutomationExecution = {
            ruleId: rule.id!,
            triggerData,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            executionTimeMs: Date.now() - startTime,
            executedAt: new Date().toISOString(),
            executedBy: userId
          };

          await this.logExecution(execution);
          executions.push(execution);
        }
      }

      return executions;
    } catch (error) {
      console.error('Failed to execute automation rules:', error);
      throw error;
    }
  }

  /**
   * Test an automation rule
   */
  async testRule(rule: AutomationRule, testScenario: Record<string, any>): Promise<AutomationTest> {
    const test: AutomationTest = {
      ruleId: rule.id || 'test',
      testScenario,
      expectedOutcome: {},
      testStatus: 'pending',
      createdBy: rule.userId,
      executedAt: new Date().toISOString()
    };

    try {
      // Check if rule conditions match test scenario
      const matches = this.evaluateConditions(rule.triggerConditions, testScenario);
      
      if (!matches) {
        test.testStatus = 'skipped';
        test.testNotes = 'Rule conditions did not match test scenario';
        test.actualOutcome = { matched: false };
      } else {
        // Simulate action execution
        const result = await this.simulateAction(rule, testScenario);
        test.actualOutcome = result;
        test.testStatus = 'passed';
        test.testNotes = 'Rule executed successfully in test mode';
      }

    } catch (error) {
      test.testStatus = 'failed';
      test.testNotes = error instanceof Error ? error.message : 'Unknown error';
      test.actualOutcome = { error: test.testNotes };
    }

    return test;
  }

  /**
   * Get execution history for a rule
   */
  async getRuleExecutions(ruleId: string): Promise<AutomationExecution[]> {
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select('*')
        .eq('rule_id', ruleId)
        .order('executed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data?.map(this.mapExecutionFromDatabase) || [];
    } catch (error) {
      console.error('Failed to fetch rule executions:', error);
      return [];
    }
  }

  /**
   * Get automation analytics for a user
   */
  async getUserAnalytics(userId: string): Promise<{
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
    successfulExecutions: number;
    averageExecutionTime: number;
    topRules: Array<{ ruleId: string; ruleName: string; executions: number }>;
  }> {
    try {
      const [rules, executions] = await Promise.all([
        this.getUserRules(userId),
        this.getUserExecutions(userId)
      ]);

      const totalRules = rules.length;
      const activeRules = rules.filter(r => r.isActive).length;
      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'success').length;
      const averageExecutionTime = executions.length > 0 
        ? executions.reduce((sum, e) => sum + (e.executionTimeMs || 0), 0) / executions.length 
        : 0;

      // Calculate top rules by execution count
      const ruleExecutionCounts = executions.reduce((acc, execution) => {
        acc[execution.ruleId] = (acc[execution.ruleId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topRules = Object.entries(ruleExecutionCounts)
        .map(([ruleId, count]) => ({
          ruleId,
          ruleName: rules.find(r => r.id === ruleId)?.ruleName || 'Unknown Rule',
          executions: count
        }))
        .sort((a, b) => b.executions - a.executions)
        .slice(0, 5);

      return {
        totalRules,
        activeRules,
        totalExecutions,
        successfulExecutions,
        averageExecutionTime,
        topRules
      };
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
      return {
        totalRules: 0,
        activeRules: 0,
        totalExecutions: 0,
        successfulExecutions: 0,
        averageExecutionTime: 0,
        topRules: []
      };
    }
  }

  /**
   * Variable substitution in text
   */
  substituteVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }

  // Private helper methods

  private async getMatchingRules(
    triggerType: AutomationRule['triggerType'],
    triggerData: Record<string, any>,
    userId: string
  ): Promise<AutomationRule[]> {
    const rules = await this.getUserRules(userId);
    
    return rules.filter(rule => {
      if (rule.triggerType !== triggerType) return false;
      return this.evaluateConditions(rule.triggerConditions, triggerData);
    }).sort((a, b) => a.executionOrder - b.executionOrder);
  }

  private evaluateConditions(conditions: Record<string, any>, data: Record<string, any>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) return false;
    }

    return true;
  }

  private async executeAction(
    rule: AutomationRule,
    triggerData: Record<string, any>,
    userId: string
  ): Promise<Record<string, any>> {
    switch (rule.actionType) {
      case 'create_deal':
        return this.executeCreateDeal(rule, triggerData, userId);
      case 'update_deal_stage':
        return this.executeUpdateDealStage(rule, triggerData, userId);
      case 'create_task':
        return this.executeCreateTask(rule, triggerData, userId);
      case 'create_activity':
        return this.executeCreateActivity(rule, triggerData, userId);
      case 'send_notification':
        return this.executeSendNotification(rule, triggerData, userId);
      default:
        throw new Error(`Unknown action type: ${rule.actionType}`);
    }
  }

  private async simulateAction(
    rule: AutomationRule,
    triggerData: Record<string, any>
  ): Promise<Record<string, any>> {
    // Simulate action execution without actually performing it
    const config = rule.actionConfig;
    const result: Record<string, any> = {
      actionType: rule.actionType,
      simulated: true,
      timestamp: new Date().toISOString()
    };

    switch (rule.actionType) {
      case 'create_deal':
        result.dealName = this.substituteVariables(
          config.dealName || '{client_name} - {activity_type}',
          triggerData
        );
        result.dealValue = config.dealValue || triggerData.amount || 0;
        break;

      case 'create_task':
        result.taskTitle = this.substituteVariables(
          config.task_title || 'Follow-up Task',
          triggerData
        );
        result.taskDescription = this.substituteVariables(
          config.task_description || 'Automated task',
          triggerData
        );
        break;

      case 'create_activity':
        result.activityType = config.activity_type || 'follow_up';
        result.activityDetails = this.substituteVariables(
          config.activity_details || 'Automated activity',
          triggerData
        );
        break;

      case 'send_notification':
        result.message = this.substituteVariables(
          config.message || 'Automation triggered',
          triggerData
        );
        result.recipients = config.recipients || ['user'];
        break;
    }

    return result;
  }

  private async executeCreateDeal(rule: AutomationRule, triggerData: Record<string, any>, userId: string): Promise<Record<string, any>> {
    const config = rule.actionConfig;
    const dealName = this.substituteVariables(
      config.dealName || '{client_name} - {activity_type}',
      triggerData
    );

    const { data, error } = await supabase
      .from('deals')
      .insert([{
        name: dealName,
        company: triggerData.client_name,
        value: config.dealValue || triggerData.amount || 0,
        stage_id: config.target_stage_id,
        owner_id: userId,
        probability: config.probability || 20,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw error;

    return { dealId: data.id, dealName, dealValue: data.value };
  }

  private async executeUpdateDealStage(rule: AutomationRule, triggerData: Record<string, any>, userId: string): Promise<Record<string, any>> {
    const config = rule.actionConfig;
    const dealId = triggerData.deal_id;

    if (!dealId) throw new Error('Deal ID is required for stage update');

    const { data, error } = await supabase
      .from('deals')
      .update({ stage_id: config.target_stage_id })
      .eq('id', dealId)
      .eq('owner_id', userId)
      .select()
      .single();

    if (error) throw error;

    return { dealId: data.id, newStageId: config.target_stage_id };
  }

  private async executeCreateTask(rule: AutomationRule, triggerData: Record<string, any>, userId: string): Promise<Record<string, any>> {
    const config = rule.actionConfig;
    const title = this.substituteVariables(config.task_title || 'Follow-up Task', triggerData);
    const description = this.substituteVariables(config.task_description || 'Automated task', triggerData);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (config.days_after || 3));

    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        type: config.task_type || 'follow_up',
        priority: config.priority || 'medium',
        status: 'pending',
        due_date: dueDate.toISOString(),
        deal_id: triggerData.deal_id,
        assigned_to: userId,
        created_by: userId
      }])
      .select()
      .single();

    if (error) throw error;

    return { taskId: data.id, title, dueDate: dueDate.toISOString() };
  }

  private async executeCreateActivity(rule: AutomationRule, triggerData: Record<string, any>, userId: string): Promise<Record<string, any>> {
    const config = rule.actionConfig;
    const details = this.substituteVariables(config.activity_details || 'Automated activity', triggerData);

    const { data, error } = await supabase
      .from('activities')
      .insert([{
        user_id: userId,
        type: config.activity_type || 'follow_up',
        client_name: triggerData.client_name || 'Unknown Client',
        details,
        amount: config.activity_amount || triggerData.amount || 0,
        priority: config.priority || 'medium',
        date: new Date().toISOString(),
        status: 'completed',
        quantity: 1,
        deal_id: triggerData.deal_id
      }])
      .select()
      .single();

    if (error) throw error;

    return { activityId: data.id, activityType: config.activity_type, details };
  }

  private async executeSendNotification(rule: AutomationRule, triggerData: Record<string, any>, userId: string): Promise<Record<string, any>> {
    const config = rule.actionConfig;
    const message = this.substituteVariables(config.message || 'Automation triggered', triggerData);

    // For now, just log the notification
    console.log(`📧 Notification: ${message} (Recipients: ${config.recipients?.join(', ')})`);

    return { 
      message, 
      recipients: config.recipients || ['user'],
      sentAt: new Date().toISOString()
    };
  }

  private async logExecution(execution: AutomationExecution): Promise<void> {
    try {
      const { error } = await supabase
        .from('automation_executions')
        .insert([{
          rule_id: execution.ruleId,
          trigger_data: execution.triggerData,
          execution_result: execution.executionResult,
          status: execution.status,
          error_message: execution.errorMessage,
          execution_time_ms: execution.executionTimeMs,
          executed_by: execution.executedBy,
          deal_id: execution.dealId,
          activity_id: execution.activityId,
          task_id: execution.taskId
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log execution:', error);
    }
  }

  private async getUserExecutions(userId: string): Promise<AutomationExecution[]> {
    try {
      const { data, error } = await supabase
        .from('automation_executions')
        .select(`
          *,
          rule:user_automation_rules!inner(user_id)
        `)
        .eq('rule.user_id', userId)
        .order('executed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return data?.map(this.mapExecutionFromDatabase) || [];
    } catch (error) {
      console.error('Failed to fetch user executions:', error);
      return [];
    }
  }

  private mapFromDatabase(data: any): AutomationRule {
    return {
      id: data.id,
      userId: data.user_id,
      ruleName: data.rule_name,
      ruleDescription: data.rule_description,
      triggerType: data.trigger_type,
      triggerConditions: data.trigger_conditions || {},
      actionType: data.action_type,
      actionConfig: data.action_config || {},
      isActive: data.is_active,
      executionOrder: data.execution_order,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapExecutionFromDatabase(data: any): AutomationExecution {
    return {
      id: data.id,
      ruleId: data.rule_id,
      triggerData: data.trigger_data || {},
      executionResult: data.execution_result,
      status: data.status,
      errorMessage: data.error_message,
      executionTimeMs: data.execution_time_ms,
      executedAt: data.executed_at,
      executedBy: data.executed_by,
      dealId: data.deal_id,
      activityId: data.activity_id,
      taskId: data.task_id
    };
  }
}

// Export singleton instance
export const unifiedAutomationEngine = UnifiedAutomationEngine.getInstance();