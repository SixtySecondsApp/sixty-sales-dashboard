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
   * Clear execution history for a workflow
   */
  clearExecutions(workflowId: string) {
    this.executionHistory.delete(workflowId);
  }
}

export const workflowExecutionService = new WorkflowExecutionService();