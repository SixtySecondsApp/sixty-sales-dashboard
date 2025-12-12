/**
 * Workflow Real-time Service
 * 
 * Service to initialize and manage real-time workflow triggers
 * Integrates with the main application lifecycle
 */

import { workflowExecutionEngine } from '@/lib/utils/workflowExecutionEngine';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export class WorkflowRealtimeService {
  private static instance: WorkflowRealtimeService;
  private isInitialized = false;
  private currentUserId: string | null = null;

  public static getInstance(): WorkflowRealtimeService {
    if (!WorkflowRealtimeService.instance) {
      WorkflowRealtimeService.instance = new WorkflowRealtimeService();
    }
    return WorkflowRealtimeService.instance;
  }

  /**
   * Initialize the workflow real-time service
   */
  async initialize(userId?: string): Promise<void> {
    try {
      if (this.isInitialized && this.currentUserId === userId) {
        logger.log('🔄 Workflow real-time service already initialized');
        return;
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await this.initializeForUser(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          this.cleanup();
        }
      });

      // Initialize for current user if provided
      if (userId) {
        await this.initializeForUser(userId);
      } else {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await this.initializeForUser(session.user.id);
        }
      }

      this.isInitialized = true;
      logger.log('✅ Workflow real-time service initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize workflow real-time service:', error);
      throw error;
    }
  }

  /**
   * Initialize workflow execution for a specific user
   */
  private async initializeForUser(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;

      // Initialize the workflow execution engine
      // The engine will set up its own real-time listeners
      await workflowExecutionEngine.executeWorkflowsForTrigger('manual', {}, userId);

      logger.log(`🎯 Workflow engine initialized for user ${userId}`);

    } catch (error) {
      logger.error(`Failed to initialize workflows for user ${userId}:`, error);
    }
  }

  /**
   * Manually trigger workflow execution for testing
   */
  async triggerWorkflow(
    triggerType: 'activity_created' | 'stage_changed' | 'deal_created' | 'task_completed' | 'call_type_classified' | 'manual',
    triggerData: Record<string, any>,
    userId?: string
  ): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        throw new Error('No user ID available for workflow execution');
      }

      logger.log(`🚀 Manually triggering ${triggerType} workflow for user ${targetUserId}`);
      
      const executions = await workflowExecutionEngine.executeWorkflowsForTrigger(
        triggerType,
        triggerData,
        targetUserId
      );

      logger.log(`✅ Triggered ${executions.length} workflow executions`);
      return executions;

    } catch (error) {
      logger.error('Failed to manually trigger workflow:', error);
      throw error;
    }
  }

  /**
   * Get workflow performance metrics
   */
  async getPerformanceMetrics(
    timeframe: 'hour' | 'day' | 'week' = 'day',
    userId?: string
  ): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        throw new Error('No user ID available for metrics');
      }

      return await workflowExecutionEngine.getPerformanceMetrics(targetUserId, timeframe);

    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      return [];
    }
  }

  /**
   * Get workflow health status
   */
  async getWorkflowHealth(userId?: string): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        throw new Error('No user ID available for health check');
      }

      return await workflowExecutionEngine.getWorkflowHealth(targetUserId);

    } catch (error) {
      logger.error('Failed to get workflow health:', error);
      return [];
    }
  }

  /**
   * Test workflow execution
   */
  async testWorkflow(ruleId: string, testData: Record<string, any>): Promise<any> {
    try {
      if (!this.currentUserId) {
        throw new Error('No user ID available for workflow testing');
      }

      // Get the specific rule
      const { data: ruleData, error } = await supabase
        .from('user_automation_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('user_id', this.currentUserId)
        .single();

      if (error || !ruleData) {
        throw new Error('Workflow rule not found');
      }

      // Convert database format to workflow rule format
      const rule = {
        id: ruleData.id,
        userId: ruleData.user_id,
        ruleName: ruleData.rule_name,
        ruleDescription: ruleData.rule_description,
        canvasData: ruleData.canvas_data || {},
        templateId: ruleData.template_id,
        triggerType: ruleData.trigger_type,
        triggerConditions: ruleData.trigger_conditions || {},
        actionType: ruleData.action_type,
        actionConfig: ruleData.action_config || {},
        isActive: ruleData.is_active,
        priorityLevel: ruleData.priority_level || 1,
        tags: ruleData.tags || [],
        lastExecutedAt: ruleData.last_executed_at,
        executionCount: ruleData.execution_count || 0,
        successCount: ruleData.success_count || 0,
        failureCount: ruleData.failure_count || 0,
        averageExecutionTimeMs: ruleData.average_execution_time_ms || 0,
        createdAt: ruleData.created_at,
        updatedAt: ruleData.updated_at
      };

      // Execute the workflow in test mode
      const execution = await workflowExecutionEngine.executeWorkflowRule(
        rule,
        testData,
        'user'
      );

      logger.log(`🧪 Test execution completed for workflow ${rule.ruleName}`);
      return execution;

    } catch (error) {
      logger.error('Failed to test workflow:', error);
      throw error;
    }
  }

  /**
   * Get active workflow executions
   */
  async getActiveExecutions(userId?: string): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        return [];
      }

      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          rule:user_automation_rules(rule_name, trigger_type, action_type)
        `)
        .eq('user_id', targetUserId)
        .in('status', ['running', 'failed'])
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('Failed to fetch active executions:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get active executions:', error);
      return [];
    }
  }

  /**
   * Get recent workflow executions with details
   */
  async getRecentExecutions(
    limit: number = 20,
    userId?: string
  ): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        return [];
      }

      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          rule:user_automation_rules(
            rule_name,
            trigger_type,
            action_type,
            canvas_data
          )
        `)
        .eq('user_id', targetUserId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch recent executions:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get recent executions:', error);
      return [];
    }
  }

  /**
   * Cancel a running workflow execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      if (!this.currentUserId) {
        throw new Error('No user ID available');
      }

      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Execution cancelled by user'
        })
        .eq('id', executionId)
        .eq('user_id', this.currentUserId)
        .eq('status', 'running');

      if (error) {
        logger.error('Failed to cancel execution:', error);
        return false;
      }

      logger.log(`🚫 Cancelled workflow execution ${executionId}`);
      return true;

    } catch (error) {
      logger.error('Failed to cancel execution:', error);
      return false;
    }
  }

  /**
   * Get workflow execution analytics
   */
  async getExecutionAnalytics(
    timeframe: 'day' | 'week' | 'month' = 'week',
    userId?: string
  ): Promise<any> {
    try {
      const targetUserId = userId || this.currentUserId;
      if (!targetUserId) {
        return null;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeframe) {
        case 'day':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(endDate.getDate() - 30);
          break;
      }

      // Get execution statistics
      const { data: executions, error: execError } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());

      if (execError) {
        logger.error('Failed to fetch execution analytics:', execError);
        return null;
      }

      // Calculate analytics
      const totalExecutions = executions?.length || 0;
      const successfulExecutions = executions?.filter(e => e.status === 'success').length || 0;
      const failedExecutions = executions?.filter(e => e.status === 'failed').length || 0;
      const avgExecutionTime = totalExecutions > 0 
        ? executions.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / totalExecutions 
        : 0;

      // Calculate business impact
      const totalDealsAffected = executions?.reduce((sum, e) => sum + (e.deals_affected || 0), 0) || 0;
      const totalTasksCreated = executions?.reduce((sum, e) => sum + (e.tasks_created || 0), 0) || 0;
      const totalActivitiesCreated = executions?.reduce((sum, e) => sum + (e.activities_created || 0), 0) || 0;
      const totalNotificationsSent = executions?.reduce((sum, e) => sum + (e.notifications_sent || 0), 0) || 0;

      // Group by trigger type
      const executionsByTrigger = executions?.reduce((acc, execution) => {
        const triggerType = execution.execution_context?.triggerType || 'unknown';
        acc[triggerType] = (acc[triggerType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Group by status over time (daily)
      const executionsByDay = executions?.reduce((acc, execution) => {
        const day = execution.started_at?.split('T')[0];
        if (!acc[day]) {
          acc[day] = { success: 0, failed: 0, total: 0 };
        }
        acc[day][execution.status === 'success' ? 'success' : 'failed']++;
        acc[day].total++;
        return acc;
      }, {} as Record<string, { success: number; failed: number; total: number }>) || {};

      return {
        timeframe,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        summary: {
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) : 0,
          avgExecutionTimeMs: Math.round(avgExecutionTime)
        },
        businessImpact: {
          totalDealsAffected,
          totalTasksCreated,
          totalActivitiesCreated,
          totalNotificationsSent
        },
        breakdowns: {
          executionsByTrigger,
          executionsByDay
        }
      };

    } catch (error) {
      logger.error('Failed to get execution analytics:', error);
      return null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    try {
      workflowExecutionEngine.cleanup();
      this.isInitialized = false;
      this.currentUserId = null;
      logger.log('🧹 Workflow real-time service cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup workflow service:', error);
    }
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Export singleton instance
export const workflowRealtimeService = WorkflowRealtimeService.getInstance();