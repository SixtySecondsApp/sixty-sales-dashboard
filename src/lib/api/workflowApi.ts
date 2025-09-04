import { supabase } from '@/lib/supabase/clientV2';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  popularity: number;
  estimated_time: string;
  tags: string[];
  trigger_type: string;
  action_type: string;
  trigger_config: any;
  action_config: any;
  canvas_data: any;
  icon_name: string;
  color: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  rule_name: string;
  rule_description?: string;
  trigger_type: string;
  trigger_conditions: any;
  action_type: string;
  action_config: any;
  is_active: boolean;
  canvas_data?: any;
  template_id?: string;
  execution_count: number;
  success_count: number;
  failure_count: number;
  last_executed_at?: string;
  average_execution_time: number;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  execution_status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  trigger_type: string;
  trigger_data: any;
  action_results?: any;
  error_message?: string;
  execution_time?: number;
  memory_usage?: number;
  started_at: string;
  completed_at?: string;
}

export interface TestResult {
  id: string;
  workflow_id: string;
  user_id: string;
  scenario_name: string;
  scenario_description?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  passed: boolean;
  execution_time?: number;
  points_earned: number;
  error_message?: string;
  test_data: any;
  created_at: string;
}

export interface UserTestingStats {
  user_id: string;
  level: number;
  xp: number;
  next_level_xp: number;
  total_points: number;
  tests_run: number;
  success_rate: number;
  current_streak: number;
  best_streak: number;
}

export interface WorkflowPerformanceMetrics {
  workflow_id: string;
  metric_date: string;
  metric_hour: number;
  execution_count: number;
  success_count: number;
  failure_count: number;
  average_execution_time: number;
  min_execution_time?: number;
  max_execution_time?: number;
}

class WorkflowAPI {
  // ===== WORKFLOWS =====
  
  async getWorkflows(userId: string, options?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Workflow[]> {
    let query = supabase
      .from('user_automation_rules')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const { data, error } = await supabase
      .from('user_automation_rules')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error) throw error;
    return data;
  }

  async createWorkflow(userId: string, workflow: Partial<Workflow>): Promise<Workflow> {
    const { data, error } = await supabase
      .from('user_automation_rules')
      .insert({
        user_id: userId,
        rule_name: workflow.rule_name || 'Untitled Workflow',
        rule_description: workflow.rule_description,
        trigger_type: workflow.trigger_type || 'manual',
        trigger_conditions: workflow.trigger_conditions || {},
        action_type: workflow.action_type || 'create_task',
        action_config: workflow.action_config || {},
        is_active: workflow.is_active ?? true,
        canvas_data: workflow.canvas_data || {},
        template_id: workflow.template_id,
        tags: workflow.tags || [],
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const { data, error } = await supabase
      .from('user_automation_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await supabase
      .from('user_automation_rules')
      .delete()
      .eq('id', workflowId);

    if (error) throw error;
  }

  async toggleWorkflowActive(workflowId: string, isActive: boolean): Promise<Workflow> {
    return this.updateWorkflow(workflowId, { is_active: isActive });
  }

  async duplicateWorkflow(workflowId: string, userId: string): Promise<Workflow> {
    const original = await this.getWorkflow(workflowId);
    if (!original) throw new Error('Workflow not found');

    return this.createWorkflow(userId, {
      ...original,
      rule_name: `${original.rule_name} (Copy)`,
      is_active: false,
      execution_count: 0,
      success_count: 0,
      failure_count: 0,
      last_executed_at: undefined,
      average_execution_time: 0
    });
  }

  // ===== TEMPLATES =====

  async getTemplates(options?: {
    category?: string;
    isPublic?: boolean;
    limit?: number;
  }): Promise<WorkflowTemplate[]> {
    let query = supabase
      .from('workflow_templates')
      .select('*')
      .order('popularity', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.isPublic !== undefined) {
      query = query.eq('is_public', options.isPublic);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getTemplate(templateId: string): Promise<WorkflowTemplate | null> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;
    return data;
  }

  async createWorkflowFromTemplate(userId: string, templateId: string): Promise<Workflow> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    // Update template usage count
    await supabase
      .from('workflow_templates')
      .update({ popularity: template.popularity + 1 })
      .eq('id', templateId);

    return this.createWorkflow(userId, {
      rule_name: template.name,
      rule_description: template.description,
      trigger_type: template.trigger_type,
      trigger_conditions: template.trigger_config,
      action_type: template.action_type,
      action_config: template.action_config,
      canvas_data: template.canvas_data,
      template_id: templateId,
      tags: template.tags,
      is_active: false // Start inactive so user can configure
    });
  }

  // ===== EXECUTIONS =====

  async getExecutions(workflowId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowExecution[]> {
    let query = supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('execution_status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getAllExecutions(userId: string, options?: {
    limit?: number;
  }): Promise<WorkflowExecution[]> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*, user_automation_rules!inner(rule_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (error) throw error;
    return data || [];
  }

  async cancelExecution(executionId: string): Promise<void> {
    const { error } = await supabase
      .from('workflow_executions')
      .update({
        execution_status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    if (error) throw error;
  }

  // ===== TESTING =====

  async testWorkflow(workflowId: string, testData?: any): Promise<TestResult> {
    // This would trigger a test execution in the backend
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const startTime = Date.now();
    
    // Simulate test execution (in production, this would call the execution engine)
    const passed = Math.random() > 0.2; // 80% success rate for demo
    const executionTime = Math.floor(Math.random() * 500) + 100;

    const { data, error } = await supabase
      .from('workflow_test_results')
      .insert({
        workflow_id: workflowId,
        user_id: workflow.user_id,
        scenario_name: 'Manual Test',
        scenario_description: 'User-triggered test execution',
        difficulty: 'easy',
        passed,
        execution_time: executionTime,
        points_earned: passed ? 10 : 0,
        error_message: passed ? null : 'Test failed due to simulated error',
        test_data: testData || {},
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getTestResults(workflowId: string, limit = 50): Promise<TestResult[]> {
    const { data, error } = await supabase
      .from('workflow_test_results')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getUserTestingStats(userId: string): Promise<UserTestingStats | null> {
    const { data, error } = await supabase
      .from('user_testing_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error
    return data;
  }

  async getUserAchievements(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('user_testing_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ===== ANALYTICS =====

  async getWorkflowPerformance(workflowId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<WorkflowPerformanceMetrics[]> {
    let query = supabase
      .from('workflow_performance_metrics')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('metric_date', { ascending: false });

    if (options?.startDate) {
      query = query.gte('metric_date', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('metric_date', options.endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async getAggregatedPerformance(userId: string, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<any> {
    const startDate = new Date();
    if (timeRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setDate(startDate.getDate() - 90);
    }

    const { data, error } = await supabase
      .from('workflow_performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('metric_date', startDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Aggregate the data
    const aggregated = {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      dailyStats: new Map<string, any>()
    };

    data?.forEach(metric => {
      aggregated.totalExecutions += metric.execution_count;
      aggregated.successCount += metric.success_count;
      aggregated.failureCount += metric.failure_count;
      
      const date = metric.metric_date;
      if (!aggregated.dailyStats.has(date)) {
        aggregated.dailyStats.set(date, {
          date,
          executions: 0,
          successes: 0,
          failures: 0
        });
      }
      
      const daily = aggregated.dailyStats.get(date);
      daily.executions += metric.execution_count;
      daily.successes += metric.success_count;
      daily.failures += metric.failure_count;
    });

    if (aggregated.totalExecutions > 0) {
      aggregated.averageExecutionTime = Math.round(
        data.reduce((sum, m) => sum + (m.average_execution_time * m.execution_count), 0) / aggregated.totalExecutions
      );
    }

    return {
      ...aggregated,
      successRate: aggregated.totalExecutions > 0 
        ? Math.round((aggregated.successCount / aggregated.totalExecutions) * 100)
        : 0,
      dailyStats: Array.from(aggregated.dailyStats.values())
    };
  }

  async getWorkflowHealth(userId: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_workflow_health', {
      p_user_id: userId
    });

    if (error) throw error;
    return data || [];
  }

  // ===== IMPORT/EXPORT =====

  async exportWorkflow(workflowId: string): Promise<any> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    // Remove sensitive data
    const { user_id, id, created_at, updated_at, ...exportData } = workflow;
    
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      workflow: exportData
    };
  }

  async importWorkflow(userId: string, importData: any): Promise<Workflow> {
    if (importData.version !== '1.0') {
      throw new Error('Unsupported import version');
    }

    return this.createWorkflow(userId, {
      ...importData.workflow,
      is_active: false // Always import as inactive
    });
  }
}

// Export singleton instance
export const workflowAPI = new WorkflowAPI();