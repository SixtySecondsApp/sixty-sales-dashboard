/**
 * Workflow MCP Executor - Handles execution of workflows with MCP integration
 * Orchestrates AI agents, MCP servers, and workflow nodes
 */

import { MCPService, MCPToolCall } from './mcpService';
import { AIAgentNodeData } from '../../components/workflows/nodes/AIAgentNode';
import { EmailMCPNodeData } from '../../components/workflows/nodes/EmailMCPNode';
import { CalendarMCPNodeData } from '../../components/workflows/nodes/CalendarMCPNode';

export interface WorkflowNode {
  id: string;
  type: 'ai-agent' | 'email-mcp' | 'calendar-mcp' | 'form' | 'condition' | 'webhook';
  data: any;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  nodes: WorkflowNodeExecution[];
  variables: Record<string, any>;
  error?: string;
  userId: string;
}

export interface WorkflowNodeExecution {
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  input?: any;
  output?: any;
  error?: string;
  mcpCalls?: MCPToolCall[];
  logs: WorkflowLog[];
}

export interface WorkflowLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  nodeId?: string;
}

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  userId: string;
  variables: Record<string, any>;
  mcpService: MCPService;
  logger: (log: WorkflowLog) => void;
  updateNodeStatus: (nodeId: string, status: WorkflowNodeExecution) => void;
}

/**
 * Node Executors - Handlers for specific node types
 */
export class NodeExecutor {
  protected context: ExecutionContext;

  constructor(context: ExecutionContext) {
    this.context = context;
  }

  protected log(level: WorkflowLog['level'], message: string, data?: any, nodeId?: string): void {
    this.context.logger({
      timestamp: new Date(),
      level,
      message,
      data,
      nodeId
    });
  }

  protected updateNode(nodeId: string, updates: Partial<WorkflowNodeExecution>): void {
    this.context.updateNodeStatus(nodeId, updates as WorkflowNodeExecution);
  }

  protected resolveVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return this.context.variables[variable] || match;
    });
  }

  protected resolveObjectVariables(obj: any): any {
    if (typeof obj === 'string') {
      return this.resolveVariables(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObjectVariables(item));
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.resolveObjectVariables(value);
      }
      return result;
    }
    return obj;
  }
}

/**
 * AI Agent Node Executor
 */
export class AIAgentNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode): Promise<any> {
    const nodeData = node.data as AIAgentNodeData;
    const nodeId = node.id;

    this.log('info', 'Starting AI Agent execution', { nodeId, config: nodeData.config }, nodeId);
    
    this.updateNode(nodeId, {
      nodeId,
      nodeType: 'ai-agent',
      status: 'running',
      startTime: new Date(),
      logs: []
    });

    try {
      let result: any = {};
      const mcpCalls: MCPToolCall[] = [];

      // Handle MCP-enabled AI agents
      if (nodeData.config?.mcpEnabled && nodeData.config.mcpServers) {
        this.log('info', 'MCP enabled, connecting to servers', { servers: nodeData.config.mcpServers }, nodeId);
        
        // Connect to required MCP servers
        const serverStatuses = await this.context.mcpService.connectServers(nodeData.config.mcpServers);
        
        const connectedServers = serverStatuses.filter(s => s.status === 'connected');
        const failedServers = serverStatuses.filter(s => s.status === 'error');

        if (failedServers.length > 0) {
          this.log('warn', 'Some MCP servers failed to connect', { failed: failedServers }, nodeId);
        }

        if (connectedServers.length === 0) {
          throw new Error('No MCP servers could be connected');
        }

        // Get available tools
        const allTools = await this.context.mcpService.listAllTools();
        this.log('info', 'Available MCP tools', { tools: allTools }, nodeId);

        // Execute AI with MCP tool access
        result = await this.executeAIWithMCP(nodeData, allTools, mcpCalls);

      } else {
        // Regular AI execution without MCP
        result = await this.executeRegularAI(nodeData);
      }

      // Update context variables with AI output
      if (result.variables) {
        Object.assign(this.context.variables, result.variables);
      }

      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'ai-agent',
        status: 'completed',
        endTime: new Date(),
        output: result,
        mcpCalls,
        logs: []
      });

      this.log('info', 'AI Agent execution completed', { result }, nodeId);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'AI execution failed';
      
      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'ai-agent',
        status: 'failed',
        endTime: new Date(),
        error: errorMessage,
        logs: []
      });

      this.log('error', 'AI Agent execution failed', { error: errorMessage }, nodeId);
      throw error;
    }
  }

  private async executeAIWithMCP(
    nodeData: AIAgentNodeData, 
    availableTools: Record<string, any[]>,
    mcpCalls: MCPToolCall[]
  ): Promise<any> {
    // This would integrate with actual AI providers (OpenAI, Anthropic, etc.)
    // For now, simulate MCP tool calling based on the prompt and available tools

    const prompt = this.resolveVariables(nodeData.config?.userPrompt || '');
    const systemPrompt = this.resolveVariables(nodeData.config?.systemPrompt || '');

    // Simulate AI decision making about which tools to use
    const toolsToUse = this.selectToolsBasedOnPrompt(prompt, availableTools);

    if (toolsToUse.length > 0) {
      this.log('info', 'AI selected tools to use', { tools: toolsToUse });

      // Execute tools based on execution mode
      const maxCalls = nodeData.config?.maxToolCalls || 5;
      const executionMode = nodeData.config?.toolExecutionMode || 'sequential';

      if (executionMode === 'sequential') {
        for (let i = 0; i < Math.min(toolsToUse.length, maxCalls); i++) {
          const tool = toolsToUse[i];
          const call = await this.context.mcpService.callTool(tool.server, tool.name, tool.args);
          mcpCalls.push(call);

          if (call.error) {
            this.log('warn', 'Tool call failed', { tool: tool.name, error: call.error });
            break;
          }
        }
      } else if (executionMode === 'parallel') {
        const callPromises = toolsToUse.slice(0, maxCalls).map(tool => ({
          server: tool.server,
          tool: tool.name,
          args: tool.args
        }));

        const results = await this.context.mcpService.callToolsParallel(callPromises);
        mcpCalls.push(...results);
      }
    }

    // Simulate AI processing the tool results and generating final output
    const toolResults = mcpCalls.filter(call => !call.error).map(call => call.output);
    
    return {
      output: `AI processed prompt: "${prompt}" using ${mcpCalls.length} tool calls`,
      toolResults,
      variables: {
        [`ai_${Date.now()}`]: prompt.slice(0, 50)
      }
    };
  }

  private async executeRegularAI(nodeData: AIAgentNodeData): Promise<any> {
    const prompt = this.resolveVariables(nodeData.config?.userPrompt || '');
    const systemPrompt = this.resolveVariables(nodeData.config?.systemPrompt || '');

    // Simulate regular AI processing
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    return {
      output: `AI processed: "${prompt}"`,
      variables: {
        [`ai_${Date.now()}`]: prompt.slice(0, 50)
      }
    };
  }

  private selectToolsBasedOnPrompt(prompt: string, availableTools: Record<string, any[]>): Array<{
    server: string;
    name: string;
    args: any;
  }> {
    const tools: Array<{ server: string; name: string; args: any }> = [];

    // Simple keyword-based tool selection (in real implementation, AI would decide)
    const lowerPrompt = prompt.toLowerCase();

    // Calendar tools
    if (lowerPrompt.includes('calendar') || lowerPrompt.includes('meeting') || lowerPrompt.includes('schedule')) {
      const calendarTools = availableTools.calendar || [];
      
      if (lowerPrompt.includes('create') && calendarTools.some(t => t.name === 'calendar_create_event')) {
        tools.push({
          server: 'calendar',
          name: 'calendar_create_event',
          args: this.extractEventArgsFromPrompt(prompt)
        });
      }
      
      if (lowerPrompt.includes('list') && calendarTools.some(t => t.name === 'calendar_list_events')) {
        tools.push({
          server: 'calendar',
          name: 'calendar_list_events',
          args: { maxResults: 10 }
        });
      }
    }

    // Email tools
    if (lowerPrompt.includes('email') || lowerPrompt.includes('mail') || lowerPrompt.includes('send')) {
      const emailTools = availableTools.gmail || [];
      
      if (lowerPrompt.includes('send') && emailTools.some(t => t.name === 'send_email')) {
        tools.push({
          server: 'gmail',
          name: 'send_email',
          args: this.extractEmailArgsFromPrompt(prompt)
        });
      }
      
      if (lowerPrompt.includes('read') && emailTools.some(t => t.name === 'read_emails')) {
        tools.push({
          server: 'gmail',
          name: 'read_emails',
          args: { maxResults: 5 }
        });
      }
    }

    return tools;
  }

  private extractEventArgsFromPrompt(prompt: string): any {
    // Simple extraction - in real implementation, use NLP
    return {
      summary: 'Event from AI prompt',
      description: prompt,
      startDateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDateTime: new Date(Date.now() + 86400000 + 3600000).toISOString() // +1 hour
    };
  }

  private extractEmailArgsFromPrompt(prompt: string): any {
    // Simple extraction - in real implementation, use NLP
    return {
      to: 'user@example.com',
      subject: 'Message from AI Agent',
      body: prompt
    };
  }
}

/**
 * Email MCP Node Executor
 */
export class EmailMCPNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode): Promise<any> {
    const nodeData = node.data as EmailMCPNodeData;
    const nodeId = node.id;

    this.log('info', 'Starting Email MCP execution', { nodeId, config: nodeData.config }, nodeId);
    
    this.updateNode(nodeId, {
      nodeId,
      nodeType: 'email-mcp',
      status: 'running',
      startTime: new Date(),
      logs: []
    });

    try {
      const serverName = nodeData.config?.serverName || 'gmail';
      const operation = nodeData.config?.operation || 'send_email';
      const parameters = this.resolveObjectVariables(nodeData.config?.parameters || {});

      this.log('info', 'Executing email operation', { serverName, operation, parameters }, nodeId);

      // Connect to email MCP server
      await this.context.mcpService.connectServer(serverName);

      // Execute the operation
      const result = await this.context.mcpService.callTool(serverName, operation, parameters);

      if (result.error) {
        throw new Error(result.error);
      }

      // Update context variables
      if (result.output && typeof result.output === 'object') {
        this.context.variables[`email_${nodeId}`] = result.output;
      }

      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'email-mcp',
        status: 'completed',
        endTime: new Date(),
        output: result.output,
        mcpCalls: [result],
        logs: []
      });

      this.log('info', 'Email MCP execution completed', { result }, nodeId);
      return result.output;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Email operation failed';
      
      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'email-mcp',
        status: 'failed',
        endTime: new Date(),
        error: errorMessage,
        logs: []
      });

      this.log('error', 'Email MCP execution failed', { error: errorMessage }, nodeId);
      throw error;
    }
  }
}

/**
 * Calendar MCP Node Executor
 */
export class CalendarMCPNodeExecutor extends NodeExecutor {
  async execute(node: WorkflowNode): Promise<any> {
    const nodeData = node.data as CalendarMCPNodeData;
    const nodeId = node.id;

    this.log('info', 'Starting Calendar MCP execution', { nodeId, config: nodeData.config }, nodeId);
    
    this.updateNode(nodeId, {
      nodeId,
      nodeType: 'calendar-mcp',
      status: 'running',
      startTime: new Date(),
      logs: []
    });

    try {
      const serverName = nodeData.config?.serverName || 'calendar';
      const operation = nodeData.config?.operation || 'create_event';
      const parameters = this.resolveObjectVariables(nodeData.config?.parameters || {});

      this.log('info', 'Executing calendar operation', { serverName, operation, parameters }, nodeId);

      // Connect to calendar MCP server
      await this.context.mcpService.connectServer(serverName);

      // Execute the operation
      const result = await this.context.mcpService.callTool(serverName, operation, parameters);

      if (result.error) {
        throw new Error(result.error);
      }

      // Update context variables
      if (result.output && typeof result.output === 'object') {
        this.context.variables[`calendar_${nodeId}`] = result.output;
        
        // Extract specific values
        if (result.output.eventId) {
          this.context.variables.last_event_id = result.output.eventId;
        }
        if (result.output.meetLink) {
          this.context.variables.last_meet_link = result.output.meetLink;
        }
      }

      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'calendar-mcp',
        status: 'completed',
        endTime: new Date(),
        output: result.output,
        mcpCalls: [result],
        logs: []
      });

      this.log('info', 'Calendar MCP execution completed', { result }, nodeId);
      return result.output;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Calendar operation failed';
      
      this.updateNode(nodeId, {
        nodeId,
        nodeType: 'calendar-mcp',
        status: 'failed',
        endTime: new Date(),
        error: errorMessage,
        logs: []
      });

      this.log('error', 'Calendar MCP execution failed', { error: errorMessage }, nodeId);
      throw error;
    }
  }
}

/**
 * Main Workflow MCP Executor
 */
export class WorkflowMCPExecutor {
  private mcpService: MCPService;
  private executors: Map<string, any>;

  constructor() {
    this.mcpService = MCPService.getInstance();
    this.executors = new Map([
      ['ai-agent', AIAgentNodeExecutor],
      ['email-mcp', EmailMCPNodeExecutor],
      ['calendar-mcp', CalendarMCPNodeExecutor]
    ]);
  }

  /**
   * Execute a complete workflow
   */
  async executeWorkflow(
    workflowId: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    initialVariables: Record<string, any> = {},
    userId: string
  ): Promise<WorkflowExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logs: WorkflowLog[] = [];
    const nodeExecutions: Map<string, WorkflowNodeExecution> = new Map();

    // Initialize node executions
    for (const node of nodes) {
      nodeExecutions.set(node.id, {
        nodeId: node.id,
        nodeType: node.type,
        status: 'pending',
        logs: []
      });
    }

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      startTime: new Date(),
      nodes: Array.from(nodeExecutions.values()),
      variables: { ...initialVariables },
      userId
    };

    const context: ExecutionContext = {
      workflowId,
      executionId,
      userId,
      variables: execution.variables,
      mcpService: this.mcpService,
      logger: (log) => logs.push(log),
      updateNodeStatus: (nodeId, status) => {
        nodeExecutions.set(nodeId, { ...nodeExecutions.get(nodeId)!, ...status });
        execution.nodes = Array.from(nodeExecutions.values());
      }
    };

    try {
      context.logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Starting workflow execution',
        data: { workflowId, executionId, nodeCount: nodes.length }
      });

      // Execute nodes in topological order
      const executionOrder = this.getExecutionOrder(nodes, edges);
      
      for (const node of executionOrder) {
        const ExecutorClass = this.executors.get(node.type);
        
        if (!ExecutorClass) {
          throw new Error(`No executor found for node type: ${node.type}`);
        }

        const executor = new ExecutorClass(context);
        await executor.execute(node);
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      context.logger({
        timestamp: new Date(),
        level: 'info',
        message: 'Workflow execution completed',
        data: { duration: execution.duration }
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime!.getTime() - execution.startTime.getTime();
      execution.error = error instanceof Error ? error.message : 'Workflow execution failed';

      context.logger({
        timestamp: new Date(),
        level: 'error',
        message: 'Workflow execution failed',
        data: { error: execution.error }
      });

      throw error;
    } finally {
      // Clean up MCP connections if needed
      // await this.mcpService.disconnectAll();
    }

    return execution;
  }

  /**
   * Get execution order based on node dependencies
   */
  private getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    // Build dependency graph
    const dependencies = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();

    for (const node of nodes) {
      dependencies.set(node.id, new Set());
      dependents.set(node.id, new Set());
    }

    for (const edge of edges) {
      dependencies.get(edge.target)?.add(edge.source);
      dependents.get(edge.source)?.add(edge.target);
    }

    // Topological sort
    const visited = new Set<string>();
    const result: WorkflowNode[] = [];
    const nodeMap = new Map(nodes.map(node => [node.id, node]));

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Visit dependencies first
      for (const depId of dependencies.get(nodeId) || []) {
        visit(depId);
      }

      const node = nodeMap.get(nodeId);
      if (node) {
        result.push(node);
      }
    };

    // Start from nodes with no dependencies
    for (const nodeId of dependencies.keys()) {
      if (dependencies.get(nodeId)!.size === 0) {
        visit(nodeId);
      }
    }

    // Handle remaining nodes (cycles or disconnected components)
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
    }

    return result;
  }

  /**
   * Register a custom node executor
   */
  registerExecutor(nodeType: string, executorClass: any): void {
    this.executors.set(nodeType, executorClass);
  }

  /**
   * Get available node executors
   */
  getAvailableExecutors(): string[] {
    return Array.from(this.executors.keys());
  }
}

export default WorkflowMCPExecutor;