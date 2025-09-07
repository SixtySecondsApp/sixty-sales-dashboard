import { supabase } from '../supabase/clientV2';

/**
 * CRM Tool System for AI Agent Nodes
 * Provides structured access to CRM data and operations
 */

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: 'deals' | 'contacts' | 'tasks' | 'activities' | 'analytics';
  parameters: ToolParameter[];
  returns: {
    type: string;
    description: string;
  };
}

export interface ToolExecutionContext {
  userId: string;
  workflowId?: string;
  nodeId?: string;
  variables?: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    recordsAffected?: number;
    executionTime?: number;
  };
}

/**
 * Base class for all CRM tools
 */
export abstract class CRMTool {
  abstract definition: ToolDefinition;
  
  abstract execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult>;
  
  protected validateParameters(parameters: Record<string, any>): void {
    for (const param of this.definition.parameters) {
      if (param.required && !(param.name in parameters)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
      
      if (param.name in parameters) {
        const value = parameters[param.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== param.type && value !== null && value !== undefined) {
          throw new Error(
            `Parameter ${param.name} must be of type ${param.type}, got ${actualType}`
          );
        }
      }
    }
  }
}

/**
 * Tool: Search Deals
 */
export class SearchDealsTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'search_deals',
    displayName: 'Search Deals',
    description: 'Search for deals based on various criteria',
    category: 'deals',
    parameters: [
      {
        name: 'stage',
        type: 'string',
        description: 'Pipeline stage (SQL, Opportunity, Verbal, Signed)',
        required: false,
      },
      {
        name: 'minValue',
        type: 'number',
        description: 'Minimum deal value',
        required: false,
      },
      {
        name: 'maxValue',
        type: 'number',
        description: 'Maximum deal value',
        required: false,
      },
      {
        name: 'contactName',
        type: 'string',
        description: 'Contact name to search for',
        required: false,
      },
      {
        name: 'companyName',
        type: 'string',
        description: 'Company name to search for',
        required: false,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
        default: 10,
      },
    ],
    returns: {
      type: 'array',
      description: 'Array of matching deals',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      let query = supabase
        .from('deals')
        .select('*')
        .eq('user_id', context.userId);
      
      if (parameters.stage) {
        query = query.eq('stage', parameters.stage);
      }
      
      if (parameters.minValue !== undefined) {
        query = query.gte('value', parameters.minValue);
      }
      
      if (parameters.maxValue !== undefined) {
        query = query.lte('value', parameters.maxValue);
      }
      
      if (parameters.contactName) {
        query = query.ilike('contact_name', `%${parameters.contactName}%`);
      }
      
      if (parameters.companyName) {
        query = query.ilike('company_name', `%${parameters.companyName}%`);
      }
      
      query = query.limit(parameters.limit || 10);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        success: true,
        data,
        metadata: {
          recordsAffected: data?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool: Create Deal
 */
export class CreateDealTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_deal',
    displayName: 'Create Deal',
    description: 'Create a new deal in the CRM',
    category: 'deals',
    parameters: [
      {
        name: 'title',
        type: 'string',
        description: 'Deal title',
        required: true,
      },
      {
        name: 'value',
        type: 'number',
        description: 'Deal value',
        required: true,
      },
      {
        name: 'stage',
        type: 'string',
        description: 'Pipeline stage (defaults to SQL)',
        required: false,
        default: 'SQL',
      },
      {
        name: 'contactName',
        type: 'string',
        description: 'Contact name',
        required: false,
      },
      {
        name: 'companyName',
        type: 'string',
        description: 'Company name',
        required: false,
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Additional notes',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Created deal object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('deals')
        .insert({
          user_id: context.userId,
          title: parameters.title,
          value: parameters.value,
          stage: parameters.stage || 'SQL',
          contact_name: parameters.contactName,
          company_name: parameters.companyName,
          notes: parameters.notes,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        success: true,
        data,
        metadata: {
          recordsAffected: 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool: Update Deal Stage
 */
export class UpdateDealStageTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'update_deal_stage',
    displayName: 'Update Deal Stage',
    description: 'Move a deal to a different pipeline stage',
    category: 'deals',
    parameters: [
      {
        name: 'dealId',
        type: 'string',
        description: 'Deal ID to update',
        required: true,
      },
      {
        name: 'newStage',
        type: 'string',
        description: 'New pipeline stage',
        required: true,
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Stage transition notes',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated deal object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('deals')
        .update({
          stage: parameters.newStage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parameters.dealId)
        .eq('user_id', context.userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the stage transition
      if (parameters.notes) {
        await supabase.from('activities').insert({
          user_id: context.userId,
          deal_id: parameters.dealId,
          type: 'stage_change',
          description: `Stage changed to ${parameters.newStage}: ${parameters.notes}`,
          created_at: new Date().toISOString(),
        });
      }
      
      return {
        success: true,
        data,
        metadata: {
          recordsAffected: 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool: Search Contacts
 */
export class SearchContactsTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'search_contacts',
    displayName: 'Search Contacts',
    description: 'Search for contacts in the CRM',
    category: 'contacts',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Contact name to search',
        required: false,
      },
      {
        name: 'email',
        type: 'string',
        description: 'Email address to search',
        required: false,
      },
      {
        name: 'company',
        type: 'string',
        description: 'Company name to search',
        required: false,
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of results',
        required: false,
        default: 10,
      },
    ],
    returns: {
      type: 'array',
      description: 'Array of matching contacts',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('user_id', context.userId);
      
      if (parameters.name) {
        query = query.ilike('name', `%${parameters.name}%`);
      }
      
      if (parameters.email) {
        query = query.ilike('email', `%${parameters.email}%`);
      }
      
      if (parameters.company) {
        query = query.ilike('company', `%${parameters.company}%`);
      }
      
      query = query.limit(parameters.limit || 10);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        success: true,
        data,
        metadata: {
          recordsAffected: data?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool: Create Task
 */
export class CreateTaskTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_task',
    displayName: 'Create Task',
    description: 'Create a new task',
    category: 'tasks',
    parameters: [
      {
        name: 'title',
        type: 'string',
        description: 'Task title',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Task description',
        required: false,
      },
      {
        name: 'dueDate',
        type: 'string',
        description: 'Due date (ISO format)',
        required: false,
      },
      {
        name: 'priority',
        type: 'string',
        description: 'Priority (low, medium, high)',
        required: false,
        default: 'medium',
      },
      {
        name: 'dealId',
        type: 'string',
        description: 'Associated deal ID',
        required: false,
      },
      {
        name: 'contactId',
        type: 'string',
        description: 'Associated contact ID',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Created task object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: context.userId,
          title: parameters.title,
          description: parameters.description,
          due_date: parameters.dueDate,
          priority: parameters.priority || 'medium',
          status: 'pending',
          deal_id: parameters.dealId,
          contact_id: parameters.contactId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        success: true,
        data,
        metadata: {
          recordsAffected: 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool: Get Deal Analytics
 */
export class GetDealAnalyticsTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'get_deal_analytics',
    displayName: 'Get Deal Analytics',
    description: 'Get analytics and metrics for deals',
    category: 'analytics',
    parameters: [
      {
        name: 'timeframe',
        type: 'string',
        description: 'Timeframe (today, week, month, quarter, year)',
        required: false,
        default: 'month',
      },
      {
        name: 'groupBy',
        type: 'string',
        description: 'Group results by (stage, month, week)',
        required: false,
        default: 'stage',
      },
    ],
    returns: {
      type: 'object',
      description: 'Analytics data including totals, averages, and breakdowns',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (parameters.timeframe) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      const { data: deals, error } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', context.userId)
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      // Calculate analytics
      const analytics = {
        totalDeals: deals?.length || 0,
        totalValue: deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0,
        averageValue: 0,
        byStage: {} as Record<string, any>,
        conversionRate: 0,
      };
      
      if (deals && deals.length > 0) {
        analytics.averageValue = analytics.totalValue / deals.length;
        
        // Group by stage
        deals.forEach(deal => {
          const stage = deal.stage || 'Unknown';
          if (!analytics.byStage[stage]) {
            analytics.byStage[stage] = {
              count: 0,
              totalValue: 0,
            };
          }
          analytics.byStage[stage].count++;
          analytics.byStage[stage].totalValue += deal.value || 0;
        });
        
        // Calculate conversion rate
        const signedDeals = deals.filter(d => d.stage === 'Signed').length;
        analytics.conversionRate = (signedDeals / deals.length) * 100;
      }
      
      return {
        success: true,
        data: analytics,
        metadata: {
          recordsAffected: deals?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Tool Registry
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, CRMTool> = new Map();
  
  private constructor() {
    this.registerDefaultTools();
  }
  
  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }
  
  private registerDefaultTools() {
    this.registerTool(new SearchDealsTool());
    this.registerTool(new CreateDealTool());
    this.registerTool(new UpdateDealStageTool());
    this.registerTool(new SearchContactsTool());
    this.registerTool(new CreateTaskTool());
    this.registerTool(new GetDealAnalyticsTool());
  }
  
  public registerTool(tool: CRMTool) {
    this.tools.set(tool.definition.name, tool);
  }
  
  public getTool(name: string): CRMTool | undefined {
    return this.tools.get(name);
  }
  
  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }
  
  public getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.definition.category === category)
      .map(tool => tool.definition);
  }
  
  public async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }
    
    return tool.execute(parameters, context);
  }
}

/**
 * Format tools for AI consumption
 */
export function formatToolsForAI(tools: ToolDefinition[]): string {
  return tools.map(tool => {
    const params = tool.parameters.map(p => 
      `- ${p.name} (${p.type}${p.required ? ', required' : ''}): ${p.description}`
    ).join('\n');
    
    return `Tool: ${tool.displayName}
Description: ${tool.description}
Parameters:
${params}
Returns: ${tool.returns.description}`;
  }).join('\n\n');
}

/**
 * Parse AI tool call from response
 */
export function parseToolCall(aiResponse: string): {
  toolName?: string;
  parameters?: Record<string, any>;
} {
  // Look for tool call patterns in AI response
  // Format: <tool>tool_name</tool><parameters>{...}</parameters>
  const toolMatch = aiResponse.match(/<tool>(.*?)<\/tool>/);
  const paramsMatch = aiResponse.match(/<parameters>(.*?)<\/parameters>/s);
  
  if (!toolMatch) {
    // Try alternative format: TOOL: tool_name PARAMS: {...}
    const altMatch = aiResponse.match(/TOOL:\s*(\w+).*?PARAMS:\s*({.*?})/s);
    if (altMatch) {
      try {
        return {
          toolName: altMatch[1],
          parameters: JSON.parse(altMatch[2]),
        };
      } catch {
        // Invalid JSON
      }
    }
    return {};
  }
  
  let parameters: Record<string, any> = {};
  if (paramsMatch) {
    try {
      parameters = JSON.parse(paramsMatch[1]);
    } catch {
      // Try to parse as key-value pairs
      const lines = paramsMatch[1].trim().split('\n');
      lines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          parameters[key.trim()] = value;
        }
      });
    }
  }
  
  return {
    toolName: toolMatch[1],
    parameters,
  };
}