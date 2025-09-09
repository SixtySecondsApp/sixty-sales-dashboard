import { Node, Edge } from 'reactflow';
import { supabase } from '@/lib/supabase/clientV2';
import { AIProviderService } from './aiProvider';
import { formService } from './formService';
import { emailService } from './emailService';
import { notificationService } from './notificationService';
import { interpolateVariables, type VariableContext } from '@/lib/utils/promptVariables';

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNodeId?: string;
  nodeOutputs: Map<string, any>;
  variables: VariableContext;
  errors: Array<{ nodeId: string; error: string; timestamp: string }>;
}

export interface NodeExecution {
  nodeId: string;
  nodeType: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: any;
  output?: any;
  error?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName?: string;
  triggeredBy: 'form' | 'manual' | 'schedule' | 'webhook' | 'event';
  triggerData?: any;
  startedAt: string;
  completedAt?: string;
  status: ExecutionContext['status'];
  nodeExecutions: NodeExecution[];
  finalOutput?: any;
  isTestMode?: boolean;
}

type ExecutionListener = (execution: WorkflowExecution) => void;
type NodeStatusListener = (nodeId: string, status: NodeExecution['status'], data?: any) => void;

class WorkflowExecutionService {
  private executions: Map<string, WorkflowExecution> = new Map();
  private executionListeners: Map<string, Set<ExecutionListener>> = new Map();
  private workflowListeners: Map<string, Set<ExecutionListener>> = new Map();
  private nodeStatusListeners: Set<NodeStatusListener> = new Set();
  private executionHistory: Map<string, WorkflowExecution[]> = new Map();
  private aiService = AIProviderService.getInstance();

  /**
   * Start a new workflow execution
   */
  async startExecution(
    workflowId: string,
    nodes: Node[],
    edges: Edge[],
    triggeredBy: WorkflowExecution['triggeredBy'],
    triggerData?: any,
    isTestMode?: boolean,
    workflowName?: string
  ): Promise<string> {
    console.log('[WorkflowExecutionService] Starting execution:', {
      workflowId,
      triggeredBy,
      nodesCount: nodes.length,
      edgesCount: edges.length,
      triggerData
    });
    
    const executionId = crypto.randomUUID();
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowName,
      triggeredBy,
      triggerData,
      startedAt: new Date().toISOString(),
      status: 'running',
      nodeExecutions: [],
      isTestMode
    };

    this.executions.set(executionId, execution);
    this.addToHistory(workflowId, execution);
    this.notifyListeners(executionId, execution);
    this.notifyWorkflowListeners(workflowId, execution);

    console.log('[WorkflowExecutionService] Execution created and listeners notified:', executionId);

    // Start execution in background
    this.executeWorkflow(executionId, nodes, edges, triggerData).catch(error => {
      console.error('[WorkflowExecutionService] Workflow execution failed:', error);
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      this.notifyListeners(executionId, execution);
      this.notifyWorkflowListeners(workflowId, execution);
      // Save failed execution to database
      this.saveExecution(execution);
    });

    return executionId;
  }

  /**
   * Execute the workflow
   */
  private async executeWorkflow(
    executionId: string,
    nodes: Node[],
    edges: Edge[],
    triggerData?: any
  ) {
    console.log('Starting workflow execution:', executionId, { nodes: nodes.length, edges: edges.length });
    
    const execution = this.executions.get(executionId);
    if (!execution) {
      console.error('Execution not found:', executionId);
      return;
    }

    const context: ExecutionContext = {
      executionId,
      workflowId: execution.workflowId,
      startedAt: execution.startedAt,
      status: 'running',
      nodeOutputs: new Map(),
      variables: {},
      errors: []
    };

    // Initialize context with trigger data
    if (triggerData) {
      console.log('[WorkflowExecution] Processing trigger data:', triggerData);
      if (execution.triggeredBy === 'form' && triggerData.fields) {
        context.variables.formData = {
          submittedAt: new Date().toISOString(),
          fields: triggerData.fields,
          formId: triggerData.formId,
          submissionId: triggerData.submissionId
        };
        console.log('[WorkflowExecution] Form data initialized in context:', context.variables.formData);
      }
    }

    try {
      // Find the trigger node (node without incoming edges)
      const triggerNode = nodes.find(node => 
        !edges.some(edge => edge.target === node.id)
      );

      console.log('Trigger node:', triggerNode);

      if (!triggerNode) {
        throw new Error('No trigger node found in workflow');
      }

      // Execute nodes in sequence following edges
      await this.executeNode(triggerNode, nodes, edges, context, execution);

      // Mark execution as completed
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.finalOutput = Array.from(context.nodeOutputs.values()).pop();
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      context.errors.push({
        nodeId: context.currentNodeId || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    this.notifyListeners(executionId, execution);
    this.notifyWorkflowListeners(execution.workflowId, execution);
    await this.saveExecution(execution);
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: Node,
    allNodes: Node[],
    edges: Edge[],
    context: ExecutionContext,
    execution: WorkflowExecution
  ): Promise<any> {
    console.log(`[WorkflowExecution] Executing node: ${node.id} (${node.type})`);
    
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      nodeType: node.type || 'unknown',
      startedAt: new Date().toISOString(),
      status: 'running',
      input: this.getNodeInput(node, context)
    };

    execution.nodeExecutions.push(nodeExecution);
    context.currentNodeId = node.id;
    this.notifyListeners(execution.id, execution);

    try {
      // Execute based on node type
      let output: any;

      switch (node.type) {
        case 'trigger':
          output = this.executeTriggerNode(node, context);
          break;
        
        case 'form':
          output = this.executeFormNode(node, context);
          break;
        
        case 'aiAgent':
          output = await this.executeAINode(node, context);
          break;
        
        case 'customGPT':
          output = await this.executeCustomGPTNode(node, context);
          break;
        
        case 'assistantManager':
          output = await this.executeAssistantManagerNode(node, context);
          break;
        
        case 'action':
          output = await this.executeActionNode(node, context);
          break;
        
        case 'condition':
          output = this.executeConditionNode(node, context);
          break;
        
        case 'router':
          output = this.executeRouterNode(node, context);
          break;
        
        default:
          console.warn(`[WorkflowExecution] Node type ${node.type} not fully implemented, passing through`);
          output = { message: `Node type ${node.type} executed`, nodeData: node.data, input: nodeExecution.input };
      }

      // Store output
      nodeExecution.output = output;
      nodeExecution.status = 'completed';
      nodeExecution.completedAt = new Date().toISOString();
      context.nodeOutputs.set(node.id, output);

      // Update variables with node output
      this.updateContextVariables(context, node.id, output);

      // Find and execute next nodes
      const nextEdges = edges.filter(edge => edge.source === node.id);
      for (const edge of nextEdges) {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          await this.executeNode(nextNode, allNodes, edges, context, execution);
        }
      }

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = error instanceof Error ? error.message : 'Unknown error';
      nodeExecution.completedAt = new Date().toISOString();
      throw error;
    } finally {
      this.notifyListeners(execution.id, execution);
    }

    return nodeExecution.output;
  }

  /**
   * Get input for a node based on context and configuration
   */
  private getNodeInput(node: Node, context: ExecutionContext): any {
    const previousOutputs = Array.from(context.nodeOutputs.entries());
    
    return {
      nodeData: node.data,
      variables: context.variables,
      previousOutputs: previousOutputs.map(([nodeId, output]) => ({
        nodeId,
        output
      }))
    };
  }

  /**
   * Execute trigger node
   */
  private executeTriggerNode(node: Node, context: ExecutionContext): any {
    return {
      triggered: true,
      triggeredAt: new Date().toISOString(),
      triggerType: node.data?.type || 'manual',
      triggerData: context.variables.formData || {}
    };
  }

  /**
   * Execute form node
   */
  private executeFormNode(node: Node, context: ExecutionContext): any {
    return {
      formData: context.variables.formData,
      formConfig: node.data?.config,
      submittedAt: context.variables.formData?.submittedAt
    };
  }

  /**
   * Execute AI Agent node
   */
  private async executeAINode(node: Node, context: ExecutionContext): Promise<any> {
    const config = node.data?.config;
    if (!config) {
      throw new Error('AI node configuration missing');
    }

    // Interpolate variables in prompts
    const systemPrompt = interpolateVariables(config.systemPrompt || '', context.variables);
    const userPrompt = interpolateVariables(config.userPrompt || '', context.variables);

    try {
      // Call AI service
      const response = await this.aiService.complete({
        provider: config.modelProvider || 'openai',
        model: config.model || 'gpt-3.5-turbo',
        systemPrompt,
        userPrompt,
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 1000
      });

      return {
        prompt: userPrompt,
        response: response.content,
        model: config.model,
        tokensUsed: response.usage?.totalTokens,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a Custom GPT node
   */
  private async executeCustomGPTNode(node: Node, context: ExecutionContext): Promise<any> {
    const config = node.data?.config;
    if (!config) {
      throw new Error('Custom GPT node configuration missing');
    }

    if (!config.assistantId) {
      throw new Error('Assistant ID is required for Custom GPT node');
    }

    try {
      // Get user ID from context or use default
      const userId = context.variables.userId as string || undefined;
      
      // Call AI service with Custom GPT configuration
      const response = await this.aiService.executeCustomGPT(
        config,
        context.variables,
        userId
      );

      if (response.error) {
        throw new Error(response.error);
      }

      // Return structured output
      const output = {
        assistantId: config.assistantId,
        assistantName: config.assistantName,
        threadId: config.threadId || 'new',
        message: interpolateVariables(config.message || '', context.variables),
        response: response.content,
        processedData: response.processedData,
        tokensUsed: response.usage?.totalTokens,
        timestamp: new Date().toISOString(),
        metadata: response.metadata
      };

      // Store thread ID for future use if a new thread was created
      if (!config.createNewThread && response.metadata?.threadId) {
        context.variables.lastThreadId = response.metadata.threadId;
      }

      return output;
    } catch (error) {
      throw new Error(`Custom GPT execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute create task action
   */
  private async executeCreateTask(node: Node, context: ExecutionContext): Promise<any> {
    const nodeData = node.data;
    
    // Interpolate variables in task fields
    const title = interpolateVariables(nodeData?.taskTitle || 'New Task', context.variables);
    const description = interpolateVariables(nodeData?.description || '', context.variables);
    const priority = nodeData?.priority || 'medium';
    const assignedTo = nodeData?.assignedTo;
    const taskStatus = nodeData?.taskStatus || 'planned'; // Default to 'planned' stage (matches your task columns)
    
    // Map UI stage values to database status values
    const statusMapping: { [key: string]: string } = {
      'planned': 'pending',
      'started': 'in_progress',
      'complete': 'completed',
      'overdue': 'overdue'
    };
    const status = statusMapping[taskStatus] || 'pending';
    const dueDate = nodeData?.dueInDays 
      ? new Date(Date.now() + nodeData.dueInDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;

    try {
      // Create task in database
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          priority,
          status,
          assigned_to: assignedTo,
          created_by: assignedTo, // Required field
          due_date: dueDate,
          contact_email: 'workflow@system.com' // Required for constraint
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create task:', error);
        throw new Error(`Task creation failed: ${error.message}`);
      }

      return {
        action: 'task_created',
        taskId: task.id,
        title: title,
        description: description,
        priority: priority,
        status: taskStatus,
        assignedTo: assignedTo,
        dueDate: dueDate,
        createdAt: task.created_at,
        success: true
      };

    } catch (error) {
      console.error('Task creation error:', error);
      return {
        action: 'task_creation_failed',
        title: title, // Still show interpolated title for debugging
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      };
    }
  }

  /**
   * Execute send email action
   */
  private async executeSendEmail(node: Node, context: ExecutionContext): Promise<any> {
    const nodeData = node.data;
    
    try {
      // Get recipient email from node data or variables
      const recipientEmail = interpolateVariables(
        nodeData?.recipientEmail || nodeData?.to || '{{formData.fields.email}}', 
        context.variables
      );
      
      // Get email subject and content
      const subject = interpolateVariables(
        nodeData?.emailSubject || nodeData?.subject || 'Notification from Sixty Seconds', 
        context.variables
      );
      
      // Check email format preference
      const emailFormat = nodeData?.emailFormat || 'html'; // 'html', 'text', or 'both'
      
      let result;
      
      if (emailFormat === 'text' || emailFormat === 'both') {
        // Plain text email
        const plainTextBody = interpolateVariables(
          nodeData?.emailBody || nodeData?.plainTextBody || 'Notification from your workflow.', 
          context.variables
        );
        
        if (emailFormat === 'text') {
          result = await emailService.sendTextEmail(recipientEmail, subject, plainTextBody);
        } else {
          // For 'both', we'll send HTML with plain text fallback
          const htmlBody = nodeData?.htmlBody ? 
            interpolateVariables(nodeData.htmlBody, context.variables) : 
            emailService.createHtmlTemplate({
              title: subject,
              content: plainTextBody.replace(/\n/g, '<br>')
            });
          
          result = await emailService.sendHtmlEmail(recipientEmail, subject, htmlBody, plainTextBody);
        }
      } else {
        // HTML email (default)
        let htmlContent;
        
        if (nodeData?.htmlBody) {
          // Custom HTML provided
          htmlContent = interpolateVariables(nodeData.htmlBody, context.variables);
        } else {
          // Create from plain text or template
          const textContent = interpolateVariables(
            nodeData?.emailBody || 'Notification from your workflow.', 
            context.variables
          );
          
          htmlContent = emailService.createHtmlTemplate({
            title: subject,
            content: textContent.replace(/\n/g, '<br>')
          });
        }
        
        result = await emailService.sendHtmlEmail(recipientEmail, subject, htmlContent);
      }
      
      if (result.success) {
        return {
          action: 'email_sent',
          success: true,
          recipient: recipientEmail,
          subject: subject,
          format: emailFormat,
          messageId: result.messageId,
          sentAt: new Date().toISOString()
        };
      } else {
        throw new Error(result.error || 'Failed to send email');
      }
      
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        action: 'email_failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown email error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute Assistant Manager node
   */
  private async executeAssistantManagerNode(node: Node, context: ExecutionContext): Promise<any> {
    const config = node.data?.config;
    if (!config) {
      throw new Error('Assistant Manager node configuration missing');
    }

    try {
      // Get user ID from context or use default
      const userId = context.variables.userId as string || undefined;
      
      // Call AI service with Assistant Manager configuration
      const response = await this.aiService.executeAssistantManager(
        config,
        context.variables,
        userId
      );

      if (response.error) {
        throw new Error(response.error);
      }

      // Parse the result
      const result = response.processedData || JSON.parse(response.content);

      // Return structured output
      return {
        ...result,
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Assistant Manager node execution error:', error);
      throw error;
    }
  }

  /**
   * Execute send notification action
   */
  private async executeSendNotification(node: Node, context: ExecutionContext): Promise<any> {
    const nodeData = node.data;
    
    try {
      // Interpolate variables in notification fields
      const title = interpolateVariables(nodeData?.notificationTitle || 'Workflow Notification', context.variables);
      const message = interpolateVariables(nodeData?.notificationMessage || '', context.variables);
      const notificationType = nodeData?.notificationType || 'info';
      const notifyUsers = nodeData?.notifyUsers || 'current';
      
      // Get recipients based on configuration
      const recipients = await notificationService.getWorkflowNotificationRecipients(notifyUsers, {
        variables: context.variables,
        node: node
      });
      
      if (recipients.length === 0) {
        console.warn('[WorkflowExecution] No recipients found for notification');
        return {
          action: 'notification_skipped',
          success: false,
          message: 'No recipients found for notification',
          title,
          timestamp: new Date().toISOString()
        };
      }
      
      console.log(`📢 Sending notification to ${recipients.length} recipients: ${title}`);
      
      // Create notifications for all recipients
      const notifications = await notificationService.createBulk(recipients, {
        title,
        message,
        type: notificationType as any,
        category: 'workflow',
        workflow_execution_id: context.executionId,
        metadata: {
          workflow_id: context.workflowId,
          node_id: node.id,
          node_type: 'send_notification'
        },
        // Build action URL if we have entity info
        action_url: context.variables.deal?.id ? `/crm/deals/${context.variables.deal.id}` :
                   context.variables.task?.id ? `/tasks/${context.variables.task.id}` :
                   context.variables.contact?.id ? `/contacts/${context.variables.contact.id}` :
                   undefined
      });
      
      const successCount = notifications.filter(n => n !== null).length;
      const failedCount = recipients.length - successCount;
      
      return {
        action: 'notification_sent',
        success: successCount > 0,
        totalRecipients: recipients.length,
        successfulNotifications: successCount,
        failedNotifications: failedCount,
        title,
        message,
        type: notificationType,
        notifyUsers,
        recipients,
        notificationIds: notifications.filter(n => n !== null).map(n => n!.id),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Notification sending error:', error);
      return {
        action: 'notification_failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown notification error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute edit fields node - transforms variables
   */
  private async executeEditFields(node: Node, context: ExecutionContext): Promise<any> {
    const fieldMappings = node.data?.fieldMappings || [];
    
    try {
      if (fieldMappings.length === 0) {
        return {
          action: 'edit_fields_completed',
          success: true,
          message: 'No field mappings configured',
          transformedFields: {},
          timestamp: new Date().toISOString()
        };
      }

      console.log(`🔄 Edit Fields processing ${fieldMappings.length} field mappings`);
      
      const transformedFields: { [key: string]: any } = {};
      const processedMappings: any[] = [];
      
      for (const mapping of fieldMappings) {
        const { sourceField, targetField, transformation } = mapping;
        
        if (!sourceField || !targetField) {
          console.warn('⚠️ Skipping incomplete mapping:', mapping);
          continue;
        }
        
        try {
          // Get the source value using variable interpolation
          const sourceValue = interpolateVariables(sourceField, context.variables);
          
          // Apply transformation if specified
          let transformedValue = this.applyTransformation(sourceValue, transformation);
          
          // Store the transformed value
          transformedFields[targetField] = transformedValue;
          
          processedMappings.push({
            sourceField,
            targetField,
            transformation: transformation || 'none',
            sourceValue,
            transformedValue,
            success: true
          });
          
          // Update context variables so subsequent nodes can use the new variable
          context.variables[targetField] = transformedValue;
          
          console.log(`✓ Mapped: ${sourceField} → ${targetField} (${sourceValue} → ${transformedValue})`);
          
        } catch (error) {
          console.error(`❌ Error processing mapping ${sourceField} → ${targetField}:`, error);
          processedMappings.push({
            sourceField,
            targetField,
            transformation: transformation || 'none',
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          });
        }
      }
      
      const successfulMappings = processedMappings.filter(m => m.success).length;
      const failedMappings = processedMappings.filter(m => !m.success).length;
      
      return {
        action: 'edit_fields_completed',
        success: failedMappings === 0,
        totalMappings: fieldMappings.length,
        successfulMappings,
        failedMappings,
        transformedFields,
        processedMappings,
        message: `Processed ${successfulMappings} field mappings${failedMappings > 0 ? `, ${failedMappings} failed` : ''}`,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Edit fields execution error:', error);
      return {
        action: 'edit_fields_failed',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown edit fields error',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Apply transformation to a value
   */
  private applyTransformation(value: any, transformation: string): any {
    if (!transformation || transformation === 'none') {
      return value;
    }
    
    // Convert to string for most transformations
    const stringValue = String(value || '');
    
    switch (transformation) {
      case 'uppercase':
        return stringValue.toUpperCase();
        
      case 'lowercase':
        return stringValue.toLowerCase();
        
      case 'capitalize':
        return stringValue.charAt(0).toUpperCase() + stringValue.slice(1).toLowerCase();
        
      case 'trim':
        return stringValue.trim().replace(/\s+/g, '');
        
      case 'email_domain':
        const emailMatch = stringValue.match(/@(.+)$/);
        return emailMatch ? emailMatch[1] : stringValue;
        
      default:
        console.warn(`⚠️ Unknown transformation: ${transformation}`);
        return value;
    }
  }

  /**
   * Execute multi-action splitter node
   * This node acts as a splitter - it passes execution to ALL connected nodes
   */
  private async executeMultiAction(node: Node, context: ExecutionContext): Promise<any> {
    const executionMode = node.data?.executionMode || 'parallel';
    
    try {
      // Find all nodes connected from this multi_action node
      const connectedNodes = this.findConnectedActionNodes(node.id, context);
      
      if (connectedNodes.length === 0) {
        return {
          action: 'multi_action_completed',
          success: true,
          message: 'No connected action nodes found',
          executedActions: [],
          executionMode,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`🔀 Multi-action splitter executing ${connectedNodes.length} connected nodes in ${executionMode} mode`);
      
      let results: any[] = [];
      
      if (executionMode === 'parallel') {
        // Execute all connected nodes simultaneously
        const promises = connectedNodes.map(async (connectedNode) => {
          try {
            const result = await this.executeActionNode(connectedNode, context);
            return { nodeId: connectedNode.id, success: true, result };
          } catch (error) {
            console.error(`❌ Error executing connected node ${connectedNode.id}:`, error);
            return { 
              nodeId: connectedNode.id, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            };
          }
        });
        
        results = await Promise.all(promises);
        
      } else {
        // Execute connected nodes sequentially
        for (const connectedNode of connectedNodes) {
          try {
            const result = await this.executeActionNode(connectedNode, context);
            results.push({ nodeId: connectedNode.id, success: true, result });
          } catch (error) {
            console.error(`❌ Error executing connected node ${connectedNode.id}:`, error);
            results.push({ 
              nodeId: connectedNode.id, 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            
            // In sequential mode, we might want to continue or stop on error
            // For now, we'll continue executing remaining nodes
          }
        }
      }
      
      const successfulActions = results.filter(r => r.success).length;
      const failedActions = results.filter(r => !r.success).length;
      
      return {
        action: 'multi_action_completed',
        success: failedActions === 0,
        executionMode,
        totalActions: connectedNodes.length,
        successfulActions,
        failedActions,
        results,
        message: `Executed ${successfulActions} actions successfully${failedActions > 0 ? `, ${failedActions} failed` : ''}`,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Multi-action execution error:', error);
      return {
        action: 'multi_action_failed',
        success: false,
        executionMode,
        error: error instanceof Error ? error.message : 'Unknown multi-action error',
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Find all action nodes connected from a specific node
   */
  private findConnectedActionNodes(nodeId: string, context: ExecutionContext): Node[] {
    // Get edges that start from this node
    const outgoingEdges = this.edges.filter(edge => edge.source === nodeId);
    
    // Find target nodes
    const connectedNodes = outgoingEdges
      .map(edge => this.nodes.find(node => node.id === edge.target))
      .filter((node): node is Node => node !== undefined && node.type === 'action');
    
    return connectedNodes;
  }

  /**
   * Execute action node
   */
  private async executeActionNode(node: Node, context: ExecutionContext): Promise<any> {
    const actionType = node.data?.type || 'unknown';
    
    switch (actionType) {
      case 'create_task':
        return await this.executeCreateTask(node, context);
      
      case 'send_email':
        return await this.executeSendEmail(node, context);
      
      case 'multi_action':
        return await this.executeMultiAction(node, context);
      
      case 'edit_fields':
        return await this.executeEditFields(node, context);
      
      case 'meeting':
        return await this.executeMeeting(node, context);
      
      case 'join_actions':
        return await this.executeJoinActions(node, context);
      
      case 'send_notification':
        return await this.executeSendNotification(node, context);
      
      default:
        return {
          action: actionType,
          executed: true,
          timestamp: new Date().toISOString()
        };
    }
  }

  /**
   * Execute condition node
   */
  private executeConditionNode(node: Node, context: ExecutionContext): any {
    const condition = node.data?.condition || 'true';
    
    // Simple condition evaluation (in production, use a proper expression evaluator)
    let result = false;
    try {
      // This is a simplified example - in production use a safe expression evaluator
      const interpolated = interpolateVariables(condition, context.variables);
      result = interpolated.includes('true') || interpolated.includes('TRUE');
    } catch (error) {
      console.error('Condition evaluation error:', error);
    }

    return {
      condition,
      result,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Execute router node
   */
  private executeRouterNode(node: Node, context: ExecutionContext): any {
    const routerType = node.data?.routerType || 'stage';
    let selectedRoute = 'default';
    
    console.log('[WorkflowExecution] Executing router node:', { routerType, nodeData: node.data });
    
    switch (routerType) {
      case 'stage':
        // Route based on deal stage
        const stage = context.variables.formData?.fields?.stage || 'SQL';
        selectedRoute = node.data?.[`route_${stage}`] || 'continue';
        break;
      
      case 'value':
        // Route based on deal value
        const value = context.variables.formData?.fields?.value || 0;
        if (value > 100000) selectedRoute = 'high';
        else if (value > 10000) selectedRoute = 'medium';
        else selectedRoute = 'low';
        break;
      
      case 'priority':
        // Route based on priority
        const priority = context.variables.formData?.fields?.priority || 'normal';
        selectedRoute = priority;
        break;
      
      case 'owner':
        // Route based on owner
        const owner = context.variables.formData?.fields?.owner || 'unassigned';
        selectedRoute = owner;
        break;
      
      default:
        selectedRoute = 'default';
    }
    
    console.log('[WorkflowExecution] Router selected route:', selectedRoute);
    
    return {
      routerType,
      selectedRoute,
      routeData: node.data,
      input: context.variables.formData
    };
  }

  /**
   * Update context variables with node output
   */
  private updateContextVariables(context: ExecutionContext, nodeId: string, output: any) {
    // Add node output to context for next nodes to use
    if (!context.variables.workflow) {
      context.variables.workflow = {
        executionId: context.executionId,
        startTime: context.startedAt,
        currentNode: nodeId,
        previousOutput: output
      };
    } else {
      context.variables.workflow.currentNode = nodeId;
      context.variables.workflow.previousOutput = output;
    }

    // Add specific output types to context
    if (output?.response) {
      context.variables.custom = {
        ...context.variables.custom,
        lastAIResponse: output.response
      };
    }
  }

  /**
   * Save execution to database and cleanup old executions
   */
  private async saveExecution(execution: WorkflowExecution) {
    console.log('[WorkflowExecution] Saving execution to database:', execution.id);
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .insert({
          id: execution.id,
          workflow_id: execution.workflowId,
          workflow_name: execution.workflowName,
          triggered_by: execution.triggeredBy,
          trigger_data: execution.triggerData,
          started_at: execution.startedAt,
          completed_at: execution.completedAt,
          status: execution.status,
          node_executions: execution.nodeExecutions,
          final_output: execution.finalOutput,
          is_test_mode: execution.isTestMode || false
        })
        .select()
        .single();

      if (error) {
        console.error('[WorkflowExecution] Error saving execution to database:', error);
      } else {
        console.log('[WorkflowExecution] Successfully saved execution to database:', data);
        // Clean up old executions for this workflow and mode
        await this.cleanupOldExecutions(execution.workflowId, execution.isTestMode || false);
      }
    } catch (error) {
      console.error('[WorkflowExecution] Exception saving execution:', error);
    }
  }

  /**
   * Clean up old executions, keeping only the last 25 per workflow per mode
   */
  private async cleanupOldExecutions(workflowId: string, isTestMode: boolean) {
    try {
      // Get all executions for this workflow and mode, ordered by date
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('id, started_at')
        .eq('workflow_id', workflowId)
        .eq('is_test_mode', isTestMode)
        .order('started_at', { ascending: false });

      if (error) {
        console.error('[WorkflowExecution] Error fetching executions for cleanup:', error);
        return;
      }

      if (data && data.length > 25) {
        // Get IDs of executions beyond the first 25 (oldest ones)
        const executionsToDelete = data.slice(25).map(exec => exec.id);
        
        const { error: deleteError } = await supabase
          .from('workflow_executions')
          .delete()
          .in('id', executionsToDelete);

        if (deleteError) {
          console.error('[WorkflowExecution] Error deleting old executions:', deleteError);
        } else {
          console.log(`[WorkflowExecution] Cleaned up ${executionsToDelete.length} old executions for workflow ${workflowId} (test: ${isTestMode})`);
        }
      }
    } catch (error) {
      console.error('[WorkflowExecution] Exception during cleanup:', error);
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Load executions from database
   */
  async loadExecutionsFromDatabase(workflowId: string): Promise<WorkflowExecution[]> {
    console.log('[WorkflowExecution] Loading executions from database for workflow:', workflowId);
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(50); // 25 test + 25 production

      if (error) {
        console.error('[WorkflowExecution] Error loading executions from database:', error);
        return [];
      }

      const executions: WorkflowExecution[] = (data || []).map(row => ({
        id: row.id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name,
        triggeredBy: row.triggered_by,
        triggerData: row.trigger_data,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        status: row.status,
        nodeExecutions: row.node_executions || [],
        finalOutput: row.final_output,
        isTestMode: row.is_test_mode || false
      }));

      // Add to memory cache
      executions.forEach(execution => {
        this.executions.set(execution.id, execution);
        this.addToHistory(workflowId, execution);
      });

      console.log('[WorkflowExecution] Loaded', executions.length, 'executions from database');
      return executions;
    } catch (error) {
      console.error('[WorkflowExecution] Exception loading executions:', error);
      return [];
    }
  }

  /**
   * Get all executions for a workflow
   */
  getWorkflowExecutions(workflowId: string): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /**
   * Get workflow executions filtered by test mode
   */
  getWorkflowExecutionsByMode(workflowId: string, testMode?: boolean): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId && 
        (testMode === undefined || exec.isTestMode === testMode))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /**
   * Load all executions from database across all workflows
   */
  async loadAllExecutionsFromDatabase(): Promise<WorkflowExecution[]> {
    console.log('[WorkflowExecution] Loading all executions from database');
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(25);

      if (error) {
        console.error('[WorkflowExecution] Error loading all executions from database:', error);
        return [];
      }

      const executions: WorkflowExecution[] = (data || []).map(row => ({
        id: row.id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name,
        triggeredBy: row.triggered_by,
        triggerData: row.trigger_data,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        status: row.status,
        nodeExecutions: row.node_executions || [],
        finalOutput: row.final_output,
        isTestMode: row.is_test_mode || false
      }));

      // Add to memory cache
      executions.forEach(execution => {
        this.executions.set(execution.id, execution);
        this.addToHistory(execution.workflowId, execution);
      });

      console.log('[WorkflowExecution] Loaded', executions.length, 'executions from database');
      return executions;
    } catch (error) {
      console.error('[WorkflowExecution] Exception loading all executions:', error);
      return [];
    }
  }

  /**
   * Get all executions across all workflows
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /**
   * Subscribe to execution updates
   */
  subscribeToExecution(executionId: string, callback: (execution: WorkflowExecution) => void): () => void {
    if (!this.executionListeners.has(executionId)) {
      this.executionListeners.set(executionId, new Set());
    }
    
    this.executionListeners.get(executionId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.executionListeners.get(executionId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.executionListeners.delete(executionId);
        }
      }
    };
  }

  /**
   * Notify listeners of execution updates
   */
  private notifyListeners(executionId: string, execution: WorkflowExecution) {
    const listeners = this.executionListeners.get(executionId);
    if (listeners) {
      listeners.forEach(callback => callback(execution));
    }
  }

  /**
   * Clear all executions (for testing)
   */
  clearAllExecutions() {
    this.executions.clear();
    this.executionListeners.clear();
  }

  /**
   * Subscribe to all executions for a workflow
   */
  subscribe(workflowId: string, listener: ExecutionListener) {
    if (!this.workflowListeners.has(workflowId)) {
      this.workflowListeners.set(workflowId, new Set());
    }
    this.workflowListeners.get(workflowId)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.workflowListeners.get(workflowId)?.delete(listener);
    };
  }

  /**
   * Subscribe to node status updates
   */
  subscribeToNodeStatus(listener: NodeStatusListener) {
    this.nodeStatusListeners.add(listener);
    return () => {
      this.nodeStatusListeners.delete(listener);
    };
  }

  /**
   * Notify workflow listeners
   */
  private notifyWorkflowListeners(workflowId: string, execution: WorkflowExecution) {
    this.workflowListeners.get(workflowId)?.forEach(listener => {
      listener(execution);
    });
  }

  /**
   * Notify node status listeners
   */
  private notifyNodeStatus(nodeId: string, status: NodeExecution['status'], data?: any) {
    this.nodeStatusListeners.forEach(listener => {
      listener(nodeId, status, data);
    });
  }

  /**
   * Add to execution history
   */
  private addToHistory(workflowId: string, execution: WorkflowExecution) {
    if (!this.executionHistory.has(workflowId)) {
      this.executionHistory.set(workflowId, []);
    }
    const history = this.executionHistory.get(workflowId)!;
    history.unshift(execution);
    // Keep only last 50 executions per workflow (25 test + 25 production)
    if (history.length > 50) {
      history.pop();
    }
  }

  /**
   * Get execution history for a workflow
   */
  getExecutions(workflowId: string): WorkflowExecution[] {
    return this.executionHistory.get(workflowId) || [];
  }

  /**
   * Execute join actions node - merges multiple branch results
   */
  async executeJoinActions(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const waitMode = node.data.waitMode || 'all';
      const timeout = (node.data.timeout || 300) * 1000; // Convert to milliseconds
      const errorHandling = node.data.errorHandling || 'fail';
      const resultAggregation = node.data.resultAggregation || 'merge';
      
      console.log(`🔀 Join Actions executing with waitMode: ${waitMode}, errorHandling: ${errorHandling}, aggregation: ${resultAggregation}`);
      
      // Get all incoming edges to determine which branches to wait for
      const incomingEdges = context.edges?.filter(e => e.target === node.id) || [];
      const branchNodeIds = incomingEdges.map(e => e.source);
      
      if (branchNodeIds.length === 0) {
        console.log('⚠️ No incoming branches to join');
        return {
          success: true,
          result: { 
            message: 'No incoming branches to join',
            waitMode,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      console.log(`🔍 Waiting for ${branchNodeIds.length} branches: ${branchNodeIds.join(', ')}`);
      
      // Initialize tracking for branch completion
      const branchResults: Map<string, any> = new Map();
      const branchErrors: Map<string, any> = new Map();
      const startTime = Date.now();
      
      // Function to check if we should continue based on wait mode
      const shouldContinue = (): boolean => {
        const successCount = branchResults.size;
        const errorCount = branchErrors.size;
        const totalCompleted = successCount + errorCount;
        
        if (waitMode === 'all') {
          // Wait for all branches to complete
          return totalCompleted >= branchNodeIds.length;
        } else if (waitMode === 'any') {
          // Continue when at least one branch succeeds
          return successCount > 0;
        }
        return false;
      };
      
      // Simulate waiting for branches (in real implementation, this would track actual execution)
      // For now, we'll check context for branch results
      for (const branchId of branchNodeIds) {
        // In a real implementation, this would subscribe to branch completion events
        // For demonstration, we'll check if the branch has stored its result in context
        const nodeKey = `node_${branchId}_result`;
        const branchKey = `branch_${branchId}_result`;
        
        // Check both possible key formats
        const branchResult = context.variables[nodeKey] || context.variables[branchKey];
        
        if (branchResult) {
          if (branchResult.error) {
            console.log(`❌ Branch ${branchId} failed:`, branchResult.error);
            branchErrors.set(branchId, branchResult.error);
            
            if (errorHandling === 'fail') {
              throw new Error(`Branch ${branchId} failed: ${branchResult.error}`);
            }
          } else {
            console.log(`✅ Branch ${branchId} completed successfully`);
            branchResults.set(branchId, branchResult);
          }
        } else {
          // Branch hasn't completed yet
          console.log(`⏳ Branch ${branchId} still executing...`);
          
          // In wait mode 'any', we can continue if we have at least one success
          if (waitMode === 'any' && branchResults.size > 0) {
            console.log('✅ Wait mode is "any" and we have at least one success, continuing...');
            break;
          }
        }
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        const message = `Join timeout after ${timeout/1000} seconds. Completed: ${branchResults.size}/${branchNodeIds.length}`;
        console.warn(`⏱️ ${message}`);
        
        if (errorHandling === 'fail') {
          throw new Error(message);
        }
      }
      
      // Check if we should continue based on wait mode and error handling
      if (!shouldContinue() && errorHandling === 'fail') {
        throw new Error(`Not all required branches completed. Success: ${branchResults.size}, Failed: ${branchErrors.size}, Total: ${branchNodeIds.length}`);
      }
      
      // Convert results to array for aggregation
      const resultsArray = Array.from(branchResults.values());
      const errorsArray = Array.from(branchErrors.entries()).map(([id, error]) => ({ branchId: id, error }));
      
      // Aggregate results based on configuration
      let finalResult: any;
      switch (resultAggregation) {
        case 'merge':
          // Merge all results into one object
          finalResult = resultsArray.reduce((acc, result) => {
            if (typeof result === 'object' && result !== null) {
              return { ...acc, ...result };
            }
            return acc;
          }, {});
          console.log('📦 Merged results into single object');
          break;
          
        case 'array':
          // Keep results as array
          finalResult = resultsArray;
          console.log('📦 Keeping results as array');
          break;
          
        case 'first':
          // Use first result
          finalResult = resultsArray[0] || {};
          console.log('📦 Using first result');
          break;
          
        case 'last':
          // Use last result
          finalResult = resultsArray[resultsArray.length - 1] || {};
          console.log('📦 Using last result');
          break;
          
        default:
          finalResult = resultsArray;
      }
      
      // Update context with joined results
      context.variables.joinedResults = finalResult;
      context.variables[`node_${node.id}_result`] = finalResult;
      
      const summary = {
        joinedBranches: branchNodeIds.length,
        successfulBranches: branchResults.size,
        failedBranches: branchErrors.size,
        waitMode,
        errorHandling,
        resultAggregation,
        results: finalResult,
        errors: errorsArray.length > 0 ? errorsArray : undefined,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ Join Actions completed:', summary);
      
      return {
        success: true,
        result: summary
      };
    } catch (error) {
      console.error('❌ Error executing join actions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to join branches'
      };
    }
  }

  /**
   * Execute meeting actions (unified meeting node)
   */
  async executeMeeting(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const action = node.data.meetingAction || 'create';
      
      switch (action) {
        case 'create':
          return await this.createMeeting(node, context);
        case 'update':
          return await this.updateMeeting(node, context);
        case 'add_transcript':
          return await this.addMeetingTranscript(node, context);
        case 'add_summary':
          return await this.addMeetingSummary(node, context);
        case 'add_tasks':
          return await this.addMeetingTasks(node, context);
        case 'add_next_steps':
          return await this.addMeetingNextSteps(node, context);
        case 'add_coaching':
          return await this.addMeetingCoaching(node, context);
        case 'add_rating':
          return await this.addMeetingRating(node, context);
        case 'add_talk_time':
          return await this.addMeetingTalkTime(node, context);
        default:
          throw new Error(`Unknown meeting action: ${action}`);
      }
    } catch (error) {
      console.error('Error executing meeting action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute meeting action'
      };
    }
  }

  /**
   * Create a new meeting
   */
  async createMeeting(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const { title, description, scheduledFor, duration, attendees, location, meetingType } = node.data;
      
      const meetingData = {
        title: this.interpolateVariables(title || '', context),
        description: this.interpolateVariables(description || '', context),
        scheduled_for: this.interpolateVariables(scheduledFor || '', context),
        duration: parseInt(this.interpolateVariables(duration || '60', context)),
        attendees: this.interpolateVariables(attendees || '', context),
        location: this.interpolateVariables(location || '', context),
        meeting_type: this.interpolateVariables(meetingType || 'general', context),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (error) throw error;

      // Update context with meeting data
      context.variables.meeting = data;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error creating meeting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create meeting'
      };
    }
  }

  /**
   * Update an existing meeting
   */
  async updateMeeting(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      if (!meetingId) {
        throw new Error('Meeting ID is required for update');
      }

      const { title, description, scheduledFor, duration, attendees, location, meetingType } = node.data;
      
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Only include fields that are provided
      if (title) updateData.title = this.interpolateVariables(title, context);
      if (description) updateData.description = this.interpolateVariables(description, context);
      if (scheduledFor) updateData.scheduled_for = this.interpolateVariables(scheduledFor, context);
      if (duration) updateData.duration = parseInt(this.interpolateVariables(duration, context));
      if (attendees) updateData.attendees = this.interpolateVariables(attendees, context);
      if (location) updateData.location = this.interpolateVariables(location, context);
      if (meetingType) updateData.meeting_type = this.interpolateVariables(meetingType, context);

      const { data, error } = await this.supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      // Update context with meeting data
      context.variables.meeting = data;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error updating meeting:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update meeting'
      };
    }
  }

  /**
   * Add transcript to meeting
   */
  async addMeetingTranscript(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const transcript = this.interpolateVariables(node.data.transcript || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add transcript');
      }

      if (!transcript) {
        throw new Error('Transcript content is required');
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          transcript,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting transcript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting transcript'
      };
    }
  }

  /**
   * Add summary to meeting
   */
  async addMeetingSummary(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const summary = this.interpolateVariables(node.data.summary || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add summary');
      }

      if (!summary) {
        throw new Error('Summary content is required');
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          summary,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting summary'
      };
    }
  }

  /**
   * Add tasks from meeting
   */
  async addMeetingTasks(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const tasks = this.interpolateVariables(node.data.tasks || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add tasks');
      }

      if (!tasks) {
        throw new Error('Tasks content is required');
      }

      // Parse tasks if it's a JSON string, otherwise treat as plain text
      let tasksList: string[] = [];
      try {
        tasksList = JSON.parse(tasks);
      } catch {
        // If not JSON, split by lines or commas
        tasksList = tasks.split(/\n|,/).map(t => t.trim()).filter(t => t);
      }

      // Create individual task records
      const taskData = tasksList.map(task => ({
        title: task,
        description: `Task from meeting: ${meetingId}`,
        meeting_id: meetingId,
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      const { data: taskResults, error: taskError } = await this.supabase
        .from('tasks')
        .insert(taskData)
        .select();

      if (taskError) throw taskError;

      // Also update the meeting with tasks summary
      const { data: meetingData, error: meetingError } = await this.supabase
        .from('meetings')
        .update({ 
          tasks,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (meetingError) throw meetingError;

      return {
        success: true,
        result: { meeting: meetingData, tasks: taskResults }
      };
    } catch (error) {
      console.error('Error adding meeting tasks:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting tasks'
      };
    }
  }

  /**
   * Add next steps from meeting
   */
  async addMeetingNextSteps(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const nextSteps = this.interpolateVariables(node.data.nextSteps || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add next steps');
      }

      if (!nextSteps) {
        throw new Error('Next steps content is required');
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          next_steps: nextSteps,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting next steps:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting next steps'
      };
    }
  }

  /**
   * Add coaching notes to meeting
   */
  async addMeetingCoaching(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const coaching = this.interpolateVariables(node.data.coaching || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add coaching');
      }

      if (!coaching) {
        throw new Error('Coaching content is required');
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          coaching_notes: coaching,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting coaching:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting coaching'
      };
    }
  }

  /**
   * Add rating to meeting
   */
  async addMeetingRating(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const rating = this.interpolateVariables(node.data.rating || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add rating');
      }

      if (!rating) {
        throw new Error('Rating is required');
      }

      const ratingValue = parseFloat(rating);
      if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        throw new Error('Rating must be a number between 1 and 5');
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          rating: ratingValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting rating:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting rating'
      };
    }
  }

  /**
   * Add talk time data to meeting
   */
  async addMeetingTalkTime(node: any, context: WorkflowContext): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const meetingId = this.interpolateVariables(node.data.meetingId || '', context);
      const talkTimeData = this.interpolateVariables(node.data.talkTime || '', context);

      if (!meetingId) {
        throw new Error('Meeting ID is required to add talk time');
      }

      if (!talkTimeData) {
        throw new Error('Talk time data is required');
      }

      // Parse talk time data if it's JSON, otherwise store as text
      let parsedTalkTime: any = talkTimeData;
      try {
        parsedTalkTime = JSON.parse(talkTimeData);
      } catch {
        // If not JSON, assume it's a simple percentage or description
        parsedTalkTime = talkTimeData;
      }

      const { data, error } = await this.supabase
        .from('meetings')
        .update({ 
          talk_time: parsedTalkTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        result: data
      };
    } catch (error) {
      console.error('Error adding meeting talk time:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add meeting talk time'
      };
    }
  }

  /**
   * Clear execution history for a workflow
   */
  clearExecutions(workflowId: string) {
    this.executionHistory.delete(workflowId);
  }
}

export const workflowExecutionService = new WorkflowExecutionService();