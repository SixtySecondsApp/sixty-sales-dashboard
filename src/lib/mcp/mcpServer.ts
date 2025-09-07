/**
 * MCP (Model Context Protocol) Server Implementation
 * Provides a standardized interface for AI models to access CRM and workflow data
 */

import { ToolRegistry, CRMTool, ToolDefinition, ToolResult } from '../services/workflowTools';
import { supabase } from '../supabase/clientV2';

/**
 * MCP Protocol Types
 */
export interface MCPRequest {
  id: string;
  method: 'tools/list' | 'tools/call' | 'resources/list' | 'resources/get' | 'prompts/list' | 'prompts/get';
  params?: any;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Base MCP Server implementation
 */
export abstract class MCPServer {
  protected name: string;
  protected version: string;
  
  constructor(name: string, version: string = '1.0.0') {
    this.name = name;
    this.version = version;
  }
  
  /**
   * Handle incoming MCP request
   */
  public async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            id: request.id,
            result: { tools: await this.listTools() }
          };
          
        case 'tools/call':
          const toolResult = await this.callTool(
            request.params?.name,
            request.params?.arguments
          );
          return {
            id: request.id,
            result: toolResult
          };
          
        case 'resources/list':
          return {
            id: request.id,
            result: { resources: await this.listResources() }
          };
          
        case 'resources/get':
          const resource = await this.getResource(request.params?.uri);
          return {
            id: request.id,
            result: resource
          };
          
        case 'prompts/list':
          return {
            id: request.id,
            result: { prompts: await this.listPrompts() }
          };
          
        case 'prompts/get':
          const prompt = await this.getPrompt(
            request.params?.name,
            request.params?.arguments
          );
          return {
            id: request.id,
            result: prompt
          };
          
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }
    } catch (error) {
      return {
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error
        }
      };
    }
  }
  
  /**
   * List available tools
   */
  protected abstract listTools(): Promise<MCPTool[]>;
  
  /**
   * Call a tool with arguments
   */
  protected abstract callTool(name: string, args: any): Promise<any>;
  
  /**
   * List available resources
   */
  protected abstract listResources(): Promise<MCPResource[]>;
  
  /**
   * Get a specific resource
   */
  protected abstract getResource(uri: string): Promise<any>;
  
  /**
   * List available prompts
   */
  protected abstract listPrompts(): Promise<MCPPrompt[]>;
  
  /**
   * Get a specific prompt
   */
  protected abstract getPrompt(name: string, args: any): Promise<string>;
}

/**
 * CRM MCP Server - Exposes CRM operations via MCP
 */
export class CRMMCPServer extends MCPServer {
  private toolRegistry: ToolRegistry;
  private userId: string;
  
  constructor(userId: string) {
    super('crm-mcp-server', '1.0.0');
    this.toolRegistry = ToolRegistry.getInstance();
    this.userId = userId;
  }
  
  protected async listTools(): Promise<MCPTool[]> {
    const tools = this.toolRegistry.getAllTools();
    
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: tool.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            default: param.default
          };
          return acc;
        }, {} as Record<string, any>),
        required: tool.parameters
          .filter(p => p.required)
          .map(p => p.name)
      }
    }));
  }
  
  protected async callTool(name: string, args: any): Promise<any> {
    const result = await this.toolRegistry.executeTool(
      name,
      args || {},
      {
        userId: this.userId,
        workflowId: undefined,
        nodeId: undefined
      }
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Tool execution failed');
    }
    
    return result.data;
  }
  
  protected async listResources(): Promise<MCPResource[]> {
    // List available CRM resources
    return [
      {
        uri: 'crm://deals',
        name: 'Deals',
        description: 'Access to CRM deals data',
        mimeType: 'application/json'
      },
      {
        uri: 'crm://contacts',
        name: 'Contacts',
        description: 'Access to CRM contacts data',
        mimeType: 'application/json'
      },
      {
        uri: 'crm://tasks',
        name: 'Tasks',
        description: 'Access to CRM tasks data',
        mimeType: 'application/json'
      },
      {
        uri: 'crm://activities',
        name: 'Activities',
        description: 'Access to CRM activities data',
        mimeType: 'application/json'
      }
    ];
  }
  
  protected async getResource(uri: string): Promise<any> {
    const [protocol, resource] = uri.split('://');
    
    if (protocol !== 'crm') {
      throw new Error(`Unknown protocol: ${protocol}`);
    }
    
    switch (resource) {
      case 'deals':
        const { data: deals } = await supabase
          .from('deals')
          .select('*')
          .eq('user_id', this.userId)
          .limit(100);
        return { contents: deals };
        
      case 'contacts':
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', this.userId)
          .limit(100);
        return { contents: contacts };
        
      case 'tasks':
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', this.userId)
          .limit(100);
        return { contents: tasks };
        
      case 'activities':
        const { data: activities } = await supabase
          .from('activities')
          .select('*')
          .eq('user_id', this.userId)
          .limit(100);
        return { contents: activities };
        
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
  
  protected async listPrompts(): Promise<MCPPrompt[]> {
    return [
      {
        name: 'analyze_deals',
        description: 'Analyze deals in the pipeline',
        arguments: [
          {
            name: 'timeframe',
            description: 'Time period to analyze (week, month, quarter)',
            required: false
          }
        ]
      },
      {
        name: 'qualify_lead',
        description: 'Qualify a lead based on criteria',
        arguments: [
          {
            name: 'lead_data',
            description: 'Lead information to qualify',
            required: true
          }
        ]
      },
      {
        name: 'suggest_next_action',
        description: 'Suggest next action for a deal',
        arguments: [
          {
            name: 'deal_id',
            description: 'Deal ID to analyze',
            required: true
          }
        ]
      }
    ];
  }
  
  protected async getPrompt(name: string, args: any): Promise<string> {
    switch (name) {
      case 'analyze_deals':
        const timeframe = args?.timeframe || 'month';
        return `Analyze the deals in the CRM pipeline for the last ${timeframe}. 
                Provide insights on:
                1. Total deal value and count
                2. Conversion rates between stages
                3. Average deal size
                4. Key opportunities and risks
                5. Recommended actions to improve pipeline performance`;
        
      case 'qualify_lead':
        return `Qualify the following lead based on BANT criteria (Budget, Authority, Need, Timeline):
                Lead Data: ${JSON.stringify(args?.lead_data)}
                
                Assess:
                1. Budget availability and fit
                2. Decision-making authority
                3. Business need and pain points
                4. Implementation timeline
                5. Overall qualification score (1-100)
                6. Recommended next steps`;
        
      case 'suggest_next_action':
        return `Based on the current state of deal ${args?.deal_id}, suggest the most appropriate next action.
                Consider:
                1. Current pipeline stage
                2. Days in current stage
                3. Recent activities
                4. Contact engagement level
                5. Deal value and priority
                
                Provide a specific, actionable recommendation.`;
        
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }
}

/**
 * Workflow MCP Server - Exposes workflow operations via MCP
 */
export class WorkflowMCPServer extends MCPServer {
  private userId: string;
  
  constructor(userId: string) {
    super('workflow-mcp-server', '1.0.0');
    this.userId = userId;
  }
  
  protected async listTools(): Promise<MCPTool[]> {
    return [
      {
        name: 'list_workflows',
        description: 'List all workflows',
        inputSchema: {
          type: 'object',
          properties: {
            active_only: {
              type: 'boolean',
              description: 'Filter to only active workflows'
            }
          }
        }
      },
      {
        name: 'get_workflow',
        description: 'Get workflow details',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_id: {
              type: 'string',
              description: 'Workflow ID'
            }
          },
          required: ['workflow_id']
        }
      },
      {
        name: 'execute_workflow',
        description: 'Execute a workflow',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_id: {
              type: 'string',
              description: 'Workflow ID to execute'
            },
            input_data: {
              type: 'object',
              description: 'Input data for the workflow'
            }
          },
          required: ['workflow_id']
        }
      },
      {
        name: 'get_workflow_metrics',
        description: 'Get workflow execution metrics',
        inputSchema: {
          type: 'object',
          properties: {
            workflow_id: {
              type: 'string',
              description: 'Workflow ID'
            },
            timeframe: {
              type: 'string',
              description: 'Time period (day, week, month)'
            }
          }
        }
      }
    ];
  }
  
  protected async callTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'list_workflows':
        const { data: workflows } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', this.userId);
        
        if (args?.active_only) {
          return workflows?.filter(w => w.is_active) || [];
        }
        return workflows || [];
        
      case 'get_workflow':
        const { data: workflow } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', args.workflow_id)
          .eq('user_id', this.userId)
          .single();
        return workflow;
        
      case 'execute_workflow':
        // In a real implementation, this would trigger workflow execution
        return {
          execution_id: `exec_${Date.now()}`,
          status: 'started',
          workflow_id: args.workflow_id,
          input_data: args.input_data
        };
        
      case 'get_workflow_metrics':
        // Return mock metrics for now
        return {
          workflow_id: args.workflow_id,
          timeframe: args.timeframe || 'week',
          executions: 42,
          success_rate: 0.95,
          average_duration: 1250,
          error_count: 2
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  protected async listResources(): Promise<MCPResource[]> {
    return [
      {
        uri: 'workflow://templates',
        name: 'Workflow Templates',
        description: 'Available workflow templates',
        mimeType: 'application/json'
      },
      {
        uri: 'workflow://executions',
        name: 'Workflow Executions',
        description: 'Recent workflow executions',
        mimeType: 'application/json'
      }
    ];
  }
  
  protected async getResource(uri: string): Promise<any> {
    const [protocol, resource] = uri.split('://');
    
    if (protocol !== 'workflow') {
      throw new Error(`Unknown protocol: ${protocol}`);
    }
    
    switch (resource) {
      case 'templates':
        // Return workflow templates
        return {
          contents: [
            {
              name: 'Lead Qualification',
              description: 'Automatically qualify incoming leads'
            },
            {
              name: 'Deal Follow-up',
              description: 'Create follow-up tasks for deals'
            },
            {
              name: 'Activity Logging',
              description: 'Log activities from various sources'
            }
          ]
        };
        
      case 'executions':
        // Return recent executions
        const { data: executions } = await supabase
          .from('workflow_executions')
          .select('*')
          .eq('user_id', this.userId)
          .order('created_at', { ascending: false })
          .limit(20);
        return { contents: executions || [] };
        
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }
  }
  
  protected async listPrompts(): Promise<MCPPrompt[]> {
    return [
      {
        name: 'optimize_workflow',
        description: 'Get suggestions to optimize a workflow',
        arguments: [
          {
            name: 'workflow_id',
            description: 'Workflow to optimize',
            required: true
          }
        ]
      },
      {
        name: 'create_workflow',
        description: 'Generate a workflow for a specific purpose',
        arguments: [
          {
            name: 'purpose',
            description: 'What the workflow should accomplish',
            required: true
          }
        ]
      }
    ];
  }
  
  protected async getPrompt(name: string, args: any): Promise<string> {
    switch (name) {
      case 'optimize_workflow':
        return `Analyze workflow ${args?.workflow_id} and suggest optimizations:
                1. Identify bottlenecks or inefficiencies
                2. Suggest additional automation opportunities
                3. Recommend error handling improvements
                4. Propose performance enhancements
                5. Identify missing edge cases`;
        
      case 'create_workflow':
        return `Design a workflow to ${args?.purpose}.
                Include:
                1. Required trigger conditions
                2. Step-by-step node configuration
                3. Decision points and branching logic
                4. Error handling strategies
                5. Success metrics to track`;
        
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }
}

/**
 * MCP Server Manager - Manages multiple MCP servers
 */
export class MCPServerManager {
  private servers: Map<string, MCPServer> = new Map();
  private static instance: MCPServerManager;
  
  private constructor() {}
  
  public static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager();
    }
    return MCPServerManager.instance;
  }
  
  /**
   * Register an MCP server
   */
  public registerServer(name: string, server: MCPServer): void {
    this.servers.set(name, server);
  }
  
  /**
   * Get an MCP server by name
   */
  public getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }
  
  /**
   * List all registered servers
   */
  public listServers(): string[] {
    return Array.from(this.servers.keys());
  }
  
  /**
   * Handle request for a specific server
   */
  public async handleRequest(
    serverName: string,
    request: MCPRequest
  ): Promise<MCPResponse> {
    const server = this.servers.get(serverName);
    
    if (!server) {
      return {
        id: request.id,
        error: {
          code: -32601,
          message: `Server not found: ${serverName}`
        }
      };
    }
    
    return server.handleRequest(request);
  }
  
  /**
   * Initialize default servers for a user
   */
  public initializeUserServers(userId: string): void {
    this.registerServer('crm', new CRMMCPServer(userId));
    this.registerServer('workflow', new WorkflowMCPServer(userId));
  }
}