import { Node, Edge } from 'reactflow';
import { supabase } from '@/lib/supabase/clientV2';
import { AIProviderService } from './aiProvider';
import { formService } from './formService';
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
    triggerData?: any
  ): Promise<string> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      triggeredBy,
      triggerData,
      startedAt: new Date().toISOString(),
      status: 'running',
      nodeExecutions: []
    };

    this.executions.set(executionId, execution);
    this.addToHistory(workflowId, execution);
    this.notifyListeners(executionId, execution);
    this.notifyWorkflowListeners(workflowId, execution);

    // Start execution in background
    this.executeWorkflow(executionId, nodes, edges, triggerData).catch(error => {
      console.error('Workflow execution failed:', error);
      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      this.notifyListeners(executionId, execution);
      this.notifyWorkflowListeners(workflowId, execution);
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
      if (execution.triggeredBy === 'form' && triggerData.fields) {
        context.variables.formData = {
          submittedAt: new Date().toISOString(),
          fields: triggerData.fields,
          formId: triggerData.formId,
          submissionId: triggerData.submissionId
        };
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
    this.saveExecution(execution);
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
        
        case 'action':
          output = await this.executeActionNode(node, context);
          break;
        
        case 'condition':
          output = this.executeConditionNode(node, context);
          break;
        
        default:
          output = { message: `Node type ${node.type} not implemented` };
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
      const response = await this.aiService.generateCompletion({
        provider: config.modelProvider || 'openai',
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
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
   * Execute action node
   */
  private async executeActionNode(node: Node, context: ExecutionContext): Promise<any> {
    const actionType = node.data?.type || 'unknown';
    
    switch (actionType) {
      case 'create_task':
        return {
          action: 'task_created',
          taskId: `task-${Date.now()}`,
          title: node.data?.taskTitle || 'New Task',
          priority: node.data?.priority || 'medium',
          dueDate: new Date(Date.now() + (node.data?.dueInDays || 3) * 24 * 60 * 60 * 1000).toISOString()
        };
      
      case 'send_notification':
        return {
          action: 'notification_sent',
          message: interpolateVariables(node.data?.message || 'Notification', context.variables),
          sentAt: new Date().toISOString()
        };
      
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
   * Save execution to database
   */
  private async saveExecution(execution: WorkflowExecution) {
    try {
      await supabase
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
          final_output: execution.finalOutput
        });
    } catch (error) {
      console.error('Error saving execution:', error);
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
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
    // Keep only last 50 executions per workflow
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
   * Clear execution history for a workflow
   */
  clearExecutions(workflowId: string) {
    this.executionHistory.delete(workflowId);
  }
}

export const workflowExecutionService = new WorkflowExecutionService();