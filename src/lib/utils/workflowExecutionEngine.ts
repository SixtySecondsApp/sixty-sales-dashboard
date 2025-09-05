import { supabase } from '@/lib/supabase/clientV2';
import { RealtimeChannel } from '@supabase/supabase-js';
import { slackService } from '@/lib/services/slackService';
import { slackOAuthService } from '@/lib/services/slackOAuthService';

interface WorkflowRule {
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
}

interface WorkflowExecution {
  workflow_id: string;
  user_id: string;
  execution_status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  trigger_type: string;
  trigger_data: any;
  action_results?: any;
  error_message?: string;
  execution_time?: number;
  started_at: Date;
  completed_at?: Date;
}

export class WorkflowExecutionEngine {
  private userId: string;
  private activeWorkflows: Map<string, WorkflowRule> = new Map();
  private realtimeChannels: RealtimeChannel[] = [];
  private executionQueue: WorkflowExecution[] = [];
  private isProcessing = false;
  private performanceMetrics = new Map<string, number[]>();

  constructor(userId: string) {
    this.userId = userId;
  }

  // Initialize the engine and set up listeners
  async initialize() {
    try {
      console.log('[WorkflowEngine] Initializing for user:', this.userId);
      
      // Load active workflows
      await this.loadActiveWorkflows();
      
      // Set up real-time listeners
      this.setupRealtimeListeners();
      
      // Start processing queue
      this.startQueueProcessor();
      
      console.log('[WorkflowEngine] Initialization complete');
    } catch (error) {
      console.error('[WorkflowEngine] Initialization error:', error);
      throw error;
    }
  }

  // Load all active workflows for the user
  private async loadActiveWorkflows() {
    const { data, error } = await supabase
      .from('user_automation_rules')
      .select('*')
      .eq('user_id', this.userId)
      .eq('is_active', true);

    if (error) {
      console.error('[WorkflowEngine] Error loading workflows:', error);
      return;
    }

    // Store workflows in memory for fast access
    this.activeWorkflows.clear();
    data?.forEach(workflow => {
      this.activeWorkflows.set(workflow.id, workflow);
    });

    console.log(`[WorkflowEngine] Loaded ${this.activeWorkflows.size} active workflows`);
  }

  // Set up real-time listeners for various triggers
  private setupRealtimeListeners() {
    // Listen for deal creation/updates
    const dealsChannel = supabase
      .channel('workflow-deals')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals',
          filter: `company_user_id=eq.${this.userId}`
        },
        (payload) => this.handleDealChange(payload)
      )
      .subscribe();

    // Listen for activity creation
    const activitiesChannel = supabase
      .channel('workflow-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => this.handleActivityCreated(payload)
      )
      .subscribe();

    // Listen for task completion
    const tasksChannel = supabase
      .channel('workflow-tasks')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${this.userId}`
        },
        (payload) => this.handleTaskUpdate(payload)
      )
      .subscribe();

    this.realtimeChannels = [dealsChannel, activitiesChannel, tasksChannel];
    console.log('[WorkflowEngine] Real-time listeners set up');
  }

  // Handle deal changes (creation, stage changes)
  private async handleDealChange(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Check for deal creation
    if (eventType === 'INSERT') {
      await this.triggerWorkflows('deal_created', {
        deal: newRecord,
        timestamp: new Date()
      });
    }

    // Check for stage change
    if (eventType === 'UPDATE' && newRecord.stage !== oldRecord?.stage) {
      await this.triggerWorkflows('pipeline_stage_changed', {
        deal: newRecord,
        old_stage: oldRecord?.stage,
        new_stage: newRecord.stage,
        timestamp: new Date()
      });
    }
  }

  // Handle activity creation
  private async handleActivityCreated(payload: any) {
    const { new: activity } = payload;
    
    await this.triggerWorkflows('activity_created', {
      activity,
      timestamp: new Date()
    });

    // Check for specific activity types
    if (activity.activity_type === 'proposal') {
      await this.triggerWorkflows('proposal_sent', {
        activity,
        timestamp: new Date()
      });
    }
  }

  // Handle task updates (completion)
  private async handleTaskUpdate(payload: any) {
    const { new: newTask, old: oldTask } = payload;

    if (newTask.status === 'completed' && oldTask?.status !== 'completed') {
      await this.triggerWorkflows('task_completed', {
        task: newTask,
        timestamp: new Date()
      });
    }
  }

  // Trigger workflows based on event type
  private async triggerWorkflows(triggerType: string, triggerData: any) {
    const startTime = performance.now();

    // Find matching workflows
    const matchingWorkflows = Array.from(this.activeWorkflows.values()).filter(
      workflow => workflow.trigger_type === triggerType && this.evaluateConditions(workflow.trigger_conditions, triggerData)
    );

    console.log(`[WorkflowEngine] Found ${matchingWorkflows.length} workflows for trigger: ${triggerType}`);

    // Queue executions
    for (const workflow of matchingWorkflows) {
      await this.queueExecution(workflow, triggerType, triggerData);
    }

    // Track performance
    const executionTime = performance.now() - startTime;
    this.trackPerformance(triggerType, executionTime);
  }

  // Evaluate workflow conditions
  private evaluateConditions(conditions: any, data: any): boolean {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true; // No conditions means always trigger
    }

    // Implement condition evaluation logic
    for (const [key, value] of Object.entries(conditions)) {
      const dataValue = this.getNestedValue(data, key);
      
      // Support different condition operators
      if (typeof value === 'object' && value !== null) {
        if (value.$eq !== undefined && dataValue !== value.$eq) return false;
        if (value.$ne !== undefined && dataValue === value.$ne) return false;
        if (value.$gt !== undefined && dataValue <= value.$gt) return false;
        if (value.$gte !== undefined && dataValue < value.$gte) return false;
        if (value.$lt !== undefined && dataValue >= value.$lt) return false;
        if (value.$lte !== undefined && dataValue > value.$lte) return false;
        if (value.$in !== undefined && !value.$in.includes(dataValue)) return false;
        if (value.$contains !== undefined && !dataValue?.includes(value.$contains)) return false;
      } else {
        // Simple equality check
        if (dataValue !== value) return false;
      }
    }

    return true;
  }

  // Get nested value from object using dot notation
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  // Queue a workflow execution
  private async queueExecution(workflow: WorkflowRule, triggerType: string, triggerData: any) {
    const execution: WorkflowExecution = {
      workflow_id: workflow.id,
      user_id: this.userId,
      execution_status: 'pending',
      trigger_type: triggerType,
      trigger_data: triggerData,
      started_at: new Date()
    };

    // Store in database
    const { data, error } = await supabase
      .from('workflow_executions')
      .insert(execution)
      .select()
      .single();

    if (error) {
      console.error('[WorkflowEngine] Error queueing execution:', error);
      return;
    }

    // Add to local queue
    this.executionQueue.push(data);
    console.log(`[WorkflowEngine] Queued execution for workflow: ${workflow.rule_name}`);
  }

  // Process queued executions
  private async startQueueProcessor() {
    setInterval(async () => {
      if (this.isProcessing || this.executionQueue.length === 0) return;

      this.isProcessing = true;
      
      try {
        const execution = this.executionQueue.shift();
        if (execution) {
          await this.processExecution(execution);
        }
      } catch (error) {
        console.error('[WorkflowEngine] Queue processing error:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 1000); // Process queue every second
  }

  // Process a single workflow execution
  private async processExecution(execution: WorkflowExecution) {
    const startTime = performance.now();
    const workflow = this.activeWorkflows.get(execution.workflow_id);

    if (!workflow) {
      console.error('[WorkflowEngine] Workflow not found:', execution.workflow_id);
      return;
    }

    console.log(`[WorkflowEngine] Processing workflow: ${workflow.rule_name}`);

    try {
      // Update status to running
      await this.updateExecutionStatus(execution.workflow_id, 'running');

      // Execute the action
      const actionResults = await this.executeAction(
        workflow.action_type,
        workflow.action_config,
        execution.trigger_data
      );

      // Update execution as successful
      const executionTime = Math.round(performance.now() - startTime);
      await this.updateExecutionStatus(
        execution.workflow_id,
        'success',
        actionResults,
        undefined,
        executionTime
      );

      console.log(`[WorkflowEngine] Workflow executed successfully in ${executionTime}ms`);
    } catch (error: any) {
      // Update execution as failed
      const executionTime = Math.round(performance.now() - startTime);
      await this.updateExecutionStatus(
        execution.workflow_id,
        'failed',
        undefined,
        error.message,
        executionTime
      );

      console.error('[WorkflowEngine] Workflow execution failed:', error);
    }
  }

  // Execute workflow action
  private async executeAction(actionType: string, actionConfig: any, triggerData: any): Promise<any> {
    switch (actionType) {
      case 'create_task':
        return await this.createTask(actionConfig, triggerData);
      
      case 'send_notification':
        return await this.sendNotification(actionConfig, triggerData);
      
      case 'create_activity':
        return await this.createActivity(actionConfig, triggerData);
      
      case 'update_field':
        return await this.updateField(actionConfig, triggerData);
      
      case 'send_email':
        return await this.sendEmail(actionConfig, triggerData);
      
      case 'send_slack':
        return await this.sendSlackMessage(actionConfig, triggerData);
      
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  // Action: Create a task
  private async createTask(config: any, triggerData: any): Promise<any> {
    const title = this.interpolateString(config.task_title || 'New Task', triggerData);
    const description = this.interpolateString(config.task_description || '', triggerData);
    const dueDate = this.calculateDueDate(config.delay_days || 0);

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: this.userId,
        title,
        description,
        due_date: dueDate,
        status: 'pending',
        priority: config.priority || 'medium',
        created_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return { task_created: data };
  }

  // Action: Send a notification
  private async sendNotification(config: any, triggerData: any): Promise<any> {
    const message = this.interpolateString(config.message || 'Workflow notification', triggerData);
    
    // In a real implementation, this would send actual notifications
    console.log(`[WorkflowEngine] Notification: ${message}`);
    
    // Store notification in database
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: this.userId,
        type: config.notification_type || 'workflow',
        title: config.title || 'Workflow Alert',
        message,
        read: false,
        created_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return { notification_sent: data };
  }

  // Action: Create an activity
  private async createActivity(config: any, triggerData: any): Promise<any> {
    const { data, error } = await supabase
      .from('activities')
      .insert({
        user_id: this.userId,
        deal_id: triggerData.deal?.id,
        activity_type: config.activity_type || 'note',
        description: this.interpolateString(config.description || '', triggerData),
        created_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    return { activity_created: data };
  }

  // Action: Update a field
  private async updateField(config: any, triggerData: any): Promise<any> {
    const { table, field, value } = config;
    const recordId = triggerData[table]?.id;

    if (!recordId) {
      throw new Error(`No record ID found for table: ${table}`);
    }

    const updateData = { [field]: this.interpolateString(value, triggerData) };

    const { data, error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;
    return { field_updated: data };
  }

  // Action: Send an email (mock implementation)
  private async sendEmail(config: any, triggerData: any): Promise<any> {
    const to = this.interpolateString(config.to || '', triggerData);
    const subject = this.interpolateString(config.subject || '', triggerData);
    const body = this.interpolateString(config.body || '', triggerData);

    // In production, integrate with email service
    console.log(`[WorkflowEngine] Email would be sent to: ${to}, Subject: ${subject}`);
    
    return { 
      email_queued: {
        to,
        subject,
        body,
        queued_at: new Date()
      }
    };
  }

  // Action: Send a Slack message
  private async sendSlackMessage(config: any, triggerData: any): Promise<any> {
    try {
      // Check if using OAuth (channel) or legacy webhook
      const channel = config.channel || config.slackChannel;
      const webhookUrl = config.webhook_url || config.slackWebhookUrl;
      
      // Prepare message data based on message type
      let message: any = {};
      const messageType = config.message_type || config.slackMessageType || 'simple';
      
      // Extract deal data if available
      const deal = triggerData.deal || triggerData.new || triggerData.old || {};
      const task = triggerData.task || {};
      
      // If using OAuth (channel specified)
      if (channel && !webhookUrl) {
        switch (messageType) {
          case 'deal_notification':
            message = slackOAuthService.formatDealNotification(
              deal,
              triggerData.event || 'deal_update'
            );
            break;
            
          case 'simple':
          case 'custom':
          default:
            const text = this.interpolateString(
              config.message || config.slackMessage || config.custom_message || config.slackCustomMessage || 'Workflow triggered',
              triggerData
            );
            message = { text };
            break;
        }
        
        // Send via OAuth
        const success = await slackOAuthService.sendMessage(
          this.userId,
          channel,
          message,
          config.team_id
        );
        
        if (!success) {
          throw new Error('Failed to send Slack message via OAuth');
        }
        
        console.log('[WorkflowEngine] Slack message sent via OAuth');
        
        return {
          slack_sent: {
            channel,
            message_type: messageType,
            method: 'oauth',
            sent_at: new Date()
          }
        };
      }
      
      // Legacy webhook method
      if (!webhookUrl) {
        throw new Error('Either Slack channel (OAuth) or webhook URL is required');
      }
      
      switch (messageType) {
        case 'deal_notification':
          // Format deal notification for Slack
          message = slackService.formatDealNotification(
            deal,
            {
              webhook_url: webhookUrl,
              channel: config.channel || config.slackChannel,
              username: config.username || 'Sixty Sales Bot',
              icon_emoji: config.icon_emoji || ':chart_with_upwards_trend:',
              include_deal_link: config.include_deal_link || config.slackIncludeDealLink,
              include_owner: config.include_owner || config.slackIncludeOwner,
              mention_users: config.mention_users || config.slackMentionUsers?.split(',').map((u: string) => u.trim()),
              message_template: config.message_template || config.slackCustomMessage
            },
            triggerData.event || 'deal_update'
          );
          break;
          
        case 'task_created':
          // Format task notification
          message = slackService.formatTaskNotification(
            task,
            {
              webhook_url: webhookUrl,
              channel: config.channel || config.slackChannel,
              username: config.username || 'Sixty Sales Bot',
              icon_emoji: config.icon_emoji || ':clipboard:',
              mention_users: config.mention_users || config.slackMentionUsers?.split(',').map((u: string) => u.trim())
            }
          );
          break;
          
        case 'custom':
          // Use custom message with variable interpolation
          const customMessage = this.interpolateString(
            config.custom_message || config.slackCustomMessage || 'Workflow notification',
            triggerData
          );
          message = slackService.formatGeneralNotification(
            config.title || 'Workflow Notification',
            customMessage,
            {
              webhook_url: webhookUrl,
              channel: config.channel || config.slackChannel,
              username: config.username || 'Sixty Sales Bot',
              icon_emoji: config.icon_emoji || ':bell:',
              mention_users: config.mention_users || config.slackMentionUsers?.split(',').map((u: string) => u.trim())
            }
          );
          break;
          
        case 'simple':
        default:
          // Simple text message
          const text = this.interpolateString(
            config.message || config.slackMessage || 'Workflow triggered',
            triggerData
          );
          message = {
            text,
            channel: config.channel || config.slackChannel,
            username: config.username || 'Sixty Sales Bot',
            icon_emoji: config.icon_emoji || ':bell:'
          };
          break;
      }

      // Send the message
      const success = await slackService.sendWebhookMessage(webhookUrl, message);
      
      if (!success) {
        throw new Error('Failed to send Slack message');
      }
      
      console.log('[WorkflowEngine] Slack message sent successfully');
      
      return {
        slack_sent: {
          webhook_url: webhookUrl.substring(0, 30) + '...', // Don't log full webhook URL
          message_type: messageType,
          method: 'webhook',
          sent_at: new Date()
        }
      };
      
    } catch (error) {
      console.error('[WorkflowEngine] Error sending Slack message:', error);
      throw error;
    }
  }

  // Interpolate variables in strings
  private interpolateString(template: string, data: any): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined ? String(value) : match;
    });
  }

  // Calculate due date based on delay
  private calculateDueDate(delayDays: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + delayDays);
    return date;
  }

  // Update execution status in database
  private async updateExecutionStatus(
    workflowId: string,
    status: string,
    actionResults?: any,
    errorMessage?: string,
    executionTime?: number
  ) {
    const updateData: any = {
      execution_status: status,
      completed_at: status !== 'running' ? new Date() : undefined
    };

    if (actionResults) updateData.action_results = actionResults;
    if (errorMessage) updateData.error_message = errorMessage;
    if (executionTime) updateData.execution_time = executionTime;

    await supabase
      .from('workflow_executions')
      .update(updateData)
      .eq('workflow_id', workflowId)
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(1);
  }

  // Track performance metrics
  private trackPerformance(operation: string, executionTime: number) {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(executionTime);
    
    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  // Get performance statistics
  getPerformanceStats() {
    const stats: any = {};
    
    this.performanceMetrics.forEach((metrics, operation) => {
      if (metrics.length === 0) return;
      
      const sum = metrics.reduce((a, b) => a + b, 0);
      const avg = sum / metrics.length;
      const sorted = [...metrics].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      
      stats[operation] = {
        count: metrics.length,
        average: Math.round(avg),
        median: Math.round(median),
        min: Math.round(Math.min(...metrics)),
        max: Math.round(Math.max(...metrics))
      };
    });
    
    return stats;
  }

  // Reload workflows (for when they're updated)
  async reloadWorkflows() {
    await this.loadActiveWorkflows();
    console.log('[WorkflowEngine] Workflows reloaded');
  }

  // Manually trigger a workflow (for testing)
  async manualTrigger(workflowId: string, triggerData: any = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    await this.queueExecution(
      workflow,
      'manual_trigger',
      { ...triggerData, manual: true, timestamp: new Date() }
    );
    
    console.log(`[WorkflowEngine] Manually triggered workflow: ${workflow.rule_name}`);
  }

  // Clean up resources
  async cleanup() {
    // Unsubscribe from all channels
    this.realtimeChannels.forEach(channel => {
      supabase.removeChannel(channel);
    });
    
    this.activeWorkflows.clear();
    this.executionQueue = [];
    this.performanceMetrics.clear();
    
    console.log('[WorkflowEngine] Cleaned up');
  }

  // Get execution history for a workflow
  async getExecutionHistory(workflowId: string, limit = 50) {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Get workflow health status
  async getWorkflowHealth() {
    const { data, error } = await supabase.rpc('get_workflow_health', {
      p_user_id: this.userId
    });

    if (error) throw error;
    return data;
  }
}

// Singleton instance manager
let engineInstance: WorkflowExecutionEngine | null = null;

export function getWorkflowEngine(userId: string): WorkflowExecutionEngine {
  if (!engineInstance || engineInstance['userId'] !== userId) {
    engineInstance = new WorkflowExecutionEngine(userId);
  }
  return engineInstance;
}

export function clearWorkflowEngine() {
  if (engineInstance) {
    engineInstance.cleanup();
    engineInstance = null;
  }
}

// Export singleton instance for backward compatibility
export const workflowExecutionEngine = {
  executeWorkflowsForTrigger: async (triggerType: string, triggerData: any, userId: string) => {
    const engine = getWorkflowEngine(userId);
    return engine.executeWorkflowsForTrigger(triggerType, triggerData);
  },
  getPerformanceMetrics: async (userId: string, timeframe?: any) => {
    const engine = getWorkflowEngine(userId);
    return engine.getPerformanceMetrics();
  },
  getWorkflowHealth: async (userId: string) => {
    const engine = getWorkflowEngine(userId);
    return engine.getWorkflowHealth();
  },
  cleanup: () => {
    clearWorkflowEngine();
  }
};