/**
 * Sales Dashboard MCP Tools
 * Consolidated CRUD tools to reduce token usage
 * Each tool handles multiple operations via an 'operation' parameter
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface SalesDashboardClient {
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
}

/**
 * Manage Deals - Consolidated tool for all deal operations
 */
export const manageDealsTool: Tool = {
  name: 'manage_deals',
  description: 'Manage deals: create, read, update, delete, search, or move between pipeline stages. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search', 'move_stage'],
        description: 'Operation to perform: create, read (get by ID), update, delete, search (list with filters), or move_stage'
      },
      // Create/Update fields
      id: { type: 'string', description: 'Deal ID (required for read, update, delete, move_stage)' },
      name: { type: 'string', description: 'Deal name' },
      company: { type: 'string', description: 'Company name' },
      value: { type: 'number', description: 'Deal value' },
      stage_id: { type: 'string', description: 'Pipeline stage ID' },
      contact_name: { type: 'string', description: 'Primary contact name' },
      contact_email: { type: 'string', description: 'Primary contact email' },
      expected_close_date: { type: 'string', description: 'Expected close date (ISO format)' },
      probability: { type: 'number', description: 'Win probability (0-100)' },
      description: { type: 'string', description: 'Deal description' },
      // Search filters
      status: { type: 'string', enum: ['active', 'won', 'lost', 'deleted'], description: 'Filter by status' },
      minValue: { type: 'number', description: 'Minimum deal value filter' },
      maxValue: { type: 'number', description: 'Maximum deal value filter' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' },
      sortBy: { type: 'string', description: 'Sort field (default: updated_at)' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order (default: desc)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Contacts - Consolidated tool for all contact operations
 */
export const manageContactsTool: Tool = {
  name: 'manage_contacts',
  description: 'Manage contacts: create, read, update, delete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Contact ID (required for read, update, delete)' },
      first_name: { type: 'string', description: 'First name (required for create)' },
      last_name: { type: 'string', description: 'Last name' },
      email: { type: 'string', description: 'Email address (required for create)' },
      phone: { type: 'string', description: 'Phone number' },
      title: { type: 'string', description: 'Job title' },
      company_id: { type: 'string', description: 'Company ID to link contact' },
      // Search filters
      search: { type: 'string', description: 'Search by name or email' },
      company_id_filter: { type: 'string', description: 'Filter by company ID' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Companies - Consolidated tool for all company operations
 */
export const manageCompaniesTool: Tool = {
  name: 'manage_companies',
  description: 'Manage companies: create, read, update, delete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Company ID (required for read, update, delete)' },
      name: { type: 'string', description: 'Company name (required for create)' },
      website: { type: 'string', description: 'Company website' },
      industry: { type: 'string', description: 'Industry' },
      description: { type: 'string', description: 'Company description' },
      // Search filters
      search: { type: 'string', description: 'Search by name or domain' },
      industry_filter: { type: 'string', description: 'Filter by industry' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Activities - Consolidated tool for all activity operations
 */
export const manageActivitiesTool: Tool = {
  name: 'manage_activities',
  description: 'Manage activities (calls, emails, meetings, proposals): create, read, update, delete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Activity ID (required for read, update, delete)' },
      type: { 
        type: 'string', 
        enum: ['call', 'email', 'meeting', 'proposal', 'sale', 'outbound', 'task', 'note', 'other'],
        description: 'Activity type (required for create)'
      },
      subject: { type: 'string', description: 'Activity subject/title' },
      details: { type: 'string', description: 'Activity details/notes' },
      date: { type: 'string', description: 'Activity date (ISO format, required for create)' },
      status: { type: 'string', enum: ['completed', 'pending', 'cancelled'], description: 'Activity status' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority' },
      amount: { type: 'number', description: 'Amount (for sales)' },
      deal_id: { type: 'string', description: 'Associated deal ID' },
      contact_id: { type: 'string', description: 'Associated contact ID' },
      company_id: { type: 'string', description: 'Associated company ID' },
      // Search filters
      type_filter: { type: 'string', description: 'Filter by activity type' },
      startDate: { type: 'string', description: 'Start date filter (ISO format)' },
      endDate: { type: 'string', description: 'End date filter (ISO format)' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Tasks - Consolidated tool for all task operations
 */
export const manageTasksTool: Tool = {
  name: 'manage_tasks',
  description: 'Manage tasks: create, read, update, delete, complete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'complete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Task ID (required for read, update, delete, complete)' },
      title: { type: 'string', description: 'Task title (required for create)' },
      description: { type: 'string', description: 'Task description' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority' },
      task_type: { 
        type: 'string', 
        enum: ['call', 'email', 'meeting', 'follow_up', 'demo', 'proposal', 'general'],
        description: 'Task type'
      },
      status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'], description: 'Task status' },
      due_date: { type: 'string', description: 'Due date (ISO format)' },
      assigned_to: { type: 'string', description: 'User ID to assign task to' },
      deal_id: { type: 'string', description: 'Associated deal ID' },
      contact_id: { type: 'string', description: 'Associated contact ID' },
      company_id: { type: 'string', description: 'Associated company ID' },
      // Search filters
      status_filter: { type: 'string', description: 'Filter by status' },
      priority_filter: { type: 'string', description: 'Filter by priority' },
      overdue_only: { type: 'boolean', description: 'Show only overdue tasks' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Meetings - Consolidated tool for all meeting operations
 */
export const manageMeetingsTool: Tool = {
  name: 'manage_meetings',
  description: 'Manage meetings: create, read, update, delete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Meeting ID (required for read, update, delete)' },
      title: { type: 'string', description: 'Meeting title' },
      meeting_start: { type: 'string', description: 'Meeting start time (ISO format)' },
      duration_minutes: { type: 'number', description: 'Meeting duration in minutes' },
      summary: { type: 'string', description: 'Meeting summary' },
      transcript_text: { type: 'string', description: 'Meeting transcript' },
      status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], description: 'Meeting status' },
      // Search filters
      startDate: { type: 'string', description: 'Start date filter (ISO format)' },
      endDate: { type: 'string', description: 'End date filter (ISO format)' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Manage Roadmap - Consolidated tool for roadmap operations
 */
export const manageRoadmapTool: Tool = {
  name: 'manage_roadmap',
  description: 'Manage roadmap items: create, read, update, delete, or search. Use operation parameter to specify the action.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'read', 'update', 'delete', 'search'],
        description: 'Operation to perform'
      },
      id: { type: 'string', description: 'Roadmap item ID (required for read, update, delete)' },
      title: { type: 'string', description: 'Item title (required for create)' },
      description: { type: 'string', description: 'Item description (required for create)' },
      type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'other'], description: 'Item type' },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority level' },
      status: { type: 'string', enum: ['submitted', 'under_review', 'in_progress', 'testing', 'completed', 'rejected'], description: 'Status' },
      // Search filters
      type_filter: { type: 'string', description: 'Filter by type' },
      status_filter: { type: 'string', description: 'Filter by status' },
      priority_filter: { type: 'string', description: 'Filter by priority' },
      sortBy: { type: 'string', enum: ['created_at', 'votes_count', 'priority', 'status'], description: 'Sort field' },
      sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
      limit: { type: 'number', description: 'Maximum results (default: 50)' }
    },
    required: ['operation']
  }
};

/**
 * Specialized Tools (Keep separate for clarity)
 */

/**
 * Summarize meetings tool
 */
export const summarizeMeetingsTool: Tool = {
  name: 'summarize_meetings',
  description: 'Summarize meetings for a specific time period (week, month, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['week', 'month', 'custom'],
        description: 'Time period to summarize',
        default: 'week'
      },
      startDate: {
        type: 'string',
        description: 'Start date in ISO format (required if period is custom)'
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO format (required if period is custom)'
      },
      includeActionItems: {
        type: 'boolean',
        description: 'Include action items from meetings',
        default: true
      }
    }
  }
};

/**
 * Find coldest deals tool
 */
export const findColdestDealsTool: Tool = {
  name: 'find_coldest_deals',
  description: 'Find deals that are the coldest (lowest engagement, oldest updates, highest risk)',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of deals to return',
        default: 10
      },
      minDaysSinceUpdate: {
        type: 'number',
        description: 'Minimum days since last update',
        default: 7
      },
      includeStale: {
        type: 'boolean',
        description: 'Include deals that are stale (no activity)',
        default: true
      }
    }
  }
};

/**
 * Find at-risk deals tool
 */
export const findAtRiskDealsTool: Tool = {
  name: 'find_at_risk_deals',
  description: 'Find deals that are at risk based on risk level (high/critical), low health scores, or other risk factors',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of deals to return',
        default: 20
      },
      minRiskLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Minimum risk level to include (default: medium)',
        default: 'medium'
      },
      maxHealthScore: {
        type: 'number',
        description: 'Maximum health score to include (deals with lower scores are at risk)',
        default: 60
      },
      includeHighValue: {
        type: 'boolean',
        description: 'Include high-value deals even if they have lower risk',
        default: false
      },
      minDealValue: {
        type: 'number',
        description: 'Minimum deal value to include (optional)',
        default: 0
      }
    }
  }
};

/**
 * Write impactful emails tool
 */
export const writeImpactfulEmailsTool: Tool = {
  name: 'write_impactful_emails',
  description: 'Generate high-impact emails for the week based on deal priorities, engagement levels, and sales opportunities',
  inputSchema: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        enum: ['cold_deals', 'high_value', 'at_risk', 'all'],
        description: 'Focus area for email selection',
        default: 'all'
      },
      tone: {
        type: 'string',
        enum: ['professional', 'friendly', 'concise'],
        description: 'Email tone',
        default: 'professional'
      },
      maxEmails: {
        type: 'number',
        description: 'Maximum number of emails to generate',
        default: 5
      }
    }
  }
};

/**
 * Get performance analytics tool
 */
export const getPerformanceAnalyticsTool: Tool = {
  name: 'get_performance_analytics',
  description: 'Get comprehensive performance analytics including deals, revenue, activities, and meetings for any time period. Specify the number of days to look back, or provide custom start/end dates.',
  inputSchema: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to analyze (e.g., 7 for last week, 30 for last month, 60 for last 2 months, 90 for last quarter, 365 for last year). Any positive number is accepted.',
        minimum: 1,
        maximum: 3650
      },
      startDate: {
        type: 'string',
        description: 'Start date in ISO format (optional, overrides days if provided)'
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO format (optional, defaults to today)'
      }
    },
    required: ['days']
  }
};

export const SALES_DASHBOARD_TOOLS: Tool[] = [
  manageDealsTool,
  manageContactsTool,
  manageCompaniesTool,
  manageActivitiesTool,
  manageTasksTool,
  manageMeetingsTool,
  manageRoadmapTool,
  summarizeMeetingsTool,
  findColdestDealsTool,
  findAtRiskDealsTool,
  writeImpactfulEmailsTool,
  getPerformanceAnalyticsTool
];

/**
 * Execute a tool call
 */
export async function executeTool(
  name: string,
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  switch (name) {
    case 'manage_deals':
      return await executeManageDeals(args, client);
    
    case 'manage_contacts':
      return await executeManageContacts(args, client);
    
    case 'manage_companies':
      return await executeManageCompanies(args, client);
    
    case 'manage_activities':
      return await executeManageActivities(args, client);
    
    case 'manage_tasks':
      return await executeManageTasks(args, client);
    
    case 'manage_meetings':
      return await executeManageMeetings(args, client);
    
    case 'manage_roadmap':
      return await executeManageRoadmap(args, client);
    
    case 'summarize_meetings':
      return await executeSummarizeMeetings(args, client);
    
    case 'find_coldest_deals':
      return await executeFindColdestDeals(args, client);
    
    case 'find_at_risk_deals':
      return await executeFindAtRiskDeals(args, client);
    
    case 'write_impactful_emails':
      return await executeWriteImpactfulEmails(args, client);
    
    case 'get_performance_analytics':
      return await executeGetPerformanceAnalytics(args, client);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Manage Deals - Handle all deal operations
 */
async function executeManageDeals(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { name, company, value, stage_id, contact_name, contact_email, expected_close_date, probability, description } = params;
      
      if (!name || !company || value === undefined) {
        throw new Error('Name, company, and value are required for creating a deal');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/deals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name,
          company,
          value,
          stage_id,
          owner_id: client.userId,
          contact_name,
          contact_email,
          expected_close_date,
          probability,
          description,
          status: 'active'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create deal: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        deal: data[0],
        message: `Deal "${name}" created successfully`
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Deal ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/deals?id=eq.${id}&owner_id=eq.${client.userId}&select=*,deal_stages(name)&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch deal: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Deal not found');
      }

      return {
        success: true,
        deal: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Deal ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/deals?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update deal: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        deal: data[0],
        message: 'Deal updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Deal ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/deals?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete deal: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Deal deleted successfully'
      };
    }

    case 'search': {
      const { status, minValue, maxValue, limit = 50, sortBy = 'updated_at', sortOrder = 'desc' } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/deals?owner_id=eq.${client.userId}&select=*,deal_stages(name)&order=${sortBy}.${sortOrder}&limit=${limit}`;

      if (status) queryUrl += `&status=eq.${status}`;
      if (minValue !== undefined) queryUrl += `&value=gte.${minValue}`;
      if (maxValue !== undefined) queryUrl += `&value=lte.${maxValue}`;

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search deals: ${response.status}`);
      }

      const deals = await response.json() as any[];
      return {
        success: true,
        deals,
        count: deals.length
      };
    }

    case 'move_stage': {
      const { id, stage_id } = params;
      if (!id || !stage_id) {
        throw new Error('Deal ID and stage_id are required for move_stage operation');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/deals?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          stage_id,
          stage_changed_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to move deal stage: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        deal: data[0],
        message: 'Deal stage updated successfully'
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Contacts - Handle all contact operations
 */
async function executeManageContacts(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { first_name, last_name, email, phone, title, company_id } = params;
      
      if (!first_name || !email) {
        throw new Error('First name and email are required for creating a contact');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          first_name,
          last_name,
          email,
          phone,
          title,
          company_id,
          owner_id: client.userId
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create contact: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        contact: data[0],
        message: 'Contact created successfully'
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Contact ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/contacts?id=eq.${id}&owner_id=eq.${client.userId}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch contact: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Contact not found');
      }

      return {
        success: true,
        contact: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Contact ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/contacts?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update contact: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        contact: data[0],
        message: 'Contact updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Contact ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/contacts?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete contact: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Contact deleted successfully'
      };
    }

    case 'search': {
      const { search, company_id_filter, limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/contacts?owner_id=eq.${client.userId}&limit=${limit}`;

      if (search) {
        queryUrl += `&or=(first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%)`;
      }
      if (company_id_filter) {
        queryUrl += `&company_id=eq.${company_id_filter}`;
      }

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search contacts: ${response.status}`);
      }

      const contacts = await response.json() as any[];
      return {
        success: true,
        contacts,
        count: contacts.length
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Companies - Handle all company operations
 */
async function executeManageCompanies(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { name, website, industry, description } = params;
      
      if (!name) {
        throw new Error('Company name is required for creating a company');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name,
          website,
          industry,
          description,
          owner_id: client.userId
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create company: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        company: data[0],
        message: 'Company created successfully'
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Company ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/companies?id=eq.${id}&owner_id=eq.${client.userId}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch company: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Company not found');
      }

      return {
        success: true,
        company: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Company ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/companies?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update company: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        company: data[0],
        message: 'Company updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Company ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/companies?id=eq.${id}&owner_id=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete company: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Company deleted successfully'
      };
    }

    case 'search': {
      const { search, industry_filter, limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/companies?owner_id=eq.${client.userId}&limit=${limit}`;

      if (search) {
        queryUrl += `&or=(name.ilike.%${search}%,website.ilike.%${search}%)`;
      }
      if (industry_filter) {
        queryUrl += `&industry=eq.${industry_filter}`;
      }

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search companies: ${response.status}`);
      }

      const companies = await response.json() as any[];
      return {
        success: true,
        companies,
        count: companies.length
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Activities - Handle all activity operations
 */
async function executeManageActivities(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { type, subject, details, date, status = 'completed', priority = 'medium', amount, deal_id, contact_id, company_id } = params;
      
      if (!type || !date) {
        throw new Error('Type and date are required for creating an activity');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          type,
          subject: subject || details,
          details,
          date,
          status,
          priority,
          amount,
          deal_id,
          contact_id,
          company_id,
          user_id: client.userId
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create activity: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        activity: data[0],
        message: 'Activity created successfully'
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Activity ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/activities?id=eq.${id}&user_id=eq.${client.userId}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch activity: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Activity not found');
      }

      return {
        success: true,
        activity: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Activity ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/activities?id=eq.${id}&user_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update activity: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        activity: data[0],
        message: 'Activity updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Activity ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/activities?id=eq.${id}&user_id=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete activity: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Activity deleted successfully'
      };
    }

    case 'search': {
      const { type_filter, startDate, endDate, limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/activities?user_id=eq.${client.userId}&order=date.desc&limit=${limit}`;

      if (type_filter) queryUrl += `&type=eq.${type_filter}`;
      if (startDate) queryUrl += `&date=gte.${startDate}`;
      if (endDate) queryUrl += `&date=lte.${endDate}`;

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search activities: ${response.status}`);
      }

      const activities = await response.json() as any[];
      return {
        success: true,
        activities,
        count: activities.length
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Tasks - Handle all task operations
 */
async function executeManageTasks(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { title, description, priority = 'medium', task_type = 'general', due_date, assigned_to, deal_id, contact_id, company_id } = params;
      
      if (!title) {
        throw new Error('Title is required for creating a task');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title,
          description,
          priority,
          task_type,
          due_date,
          created_by: client.userId,
          assigned_to: assigned_to || client.userId,
          deal_id,
          contact_id,
          company_id,
          status: 'todo'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create task: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        task: data[0],
        message: 'Task created successfully'
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Task ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/tasks?id=eq.${id}&assigned_to=eq.${client.userId}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Task not found');
      }

      return {
        success: true,
        task: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Task ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/tasks?id=eq.${id}&assigned_to=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update task: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        task: data[0],
        message: 'Task updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Task ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/tasks?id=eq.${id}&assigned_to=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete task: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Task deleted successfully'
      };
    }

    case 'complete': {
      const { id } = params;
      if (!id) throw new Error('Task ID is required for complete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/tasks?id=eq.${id}&assigned_to=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          status: 'done',
          completed_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to complete task: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        task: data[0],
        message: 'Task marked as complete'
      };
    }

    case 'search': {
      const { status_filter, priority_filter, overdue_only, limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/tasks?assigned_to=eq.${client.userId}&order=created_at.desc&limit=${limit}`;

      if (status_filter) queryUrl += `&status=eq.${status_filter}`;
      if (priority_filter) queryUrl += `&priority=eq.${priority_filter}`;
      if (overdue_only) {
        const today = new Date().toISOString().split('T')[0];
        queryUrl += `&due_date=lt.${today}&status=neq.done`;
      }

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search tasks: ${response.status}`);
      }

      const tasks = await response.json() as any[];
      return {
        success: true,
        tasks,
        count: tasks.length
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Meetings - Handle all meeting operations
 */
async function executeManageMeetings(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { title, meeting_start, duration_minutes, summary, status = 'scheduled' } = params;
      
      if (!title || !meeting_start) {
        throw new Error('Title and meeting_start are required for creating a meeting');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title,
          meeting_start,
          duration_minutes,
          summary,
          status,
          owner_user_id: client.userId
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create meeting: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        meeting: data[0],
        message: 'Meeting created successfully'
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Meeting ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/meetings?id=eq.${id}&owner_user_id=eq.${client.userId}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch meeting: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Meeting not found');
      }

      return {
        success: true,
        meeting: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Meeting ID is required for update operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/meetings?id=eq.${id}&owner_user_id=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update meeting: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        meeting: data[0],
        message: 'Meeting updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Meeting ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/meetings?id=eq.${id}&owner_user_id=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete meeting: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Meeting deleted successfully'
      };
    }

    case 'search': {
      const { startDate, endDate, limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/meetings?owner_user_id=eq.${client.userId}&order=meeting_start.desc&limit=${limit}`;

      if (startDate) queryUrl += `&meeting_start=gte.${startDate}`;
      if (endDate) queryUrl += `&meeting_start=lte.${endDate}`;

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search meetings: ${response.status}`);
      }

      const meetings = await response.json() as any[];
      return {
        success: true,
        meetings,
        count: meetings.length
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Manage Roadmap - Handle all roadmap operations
 */
async function executeManageRoadmap(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { operation, ...params } = args;

  switch (operation) {
    case 'create': {
      const { title, description, type = 'feature', priority = 'medium' } = params;

      if (!title || !description) {
        throw new Error('Title and description are required for creating a roadmap item');
      }

      const response = await fetch(`${client.supabaseUrl}/rest/v1/roadmap_suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title,
          description,
          type,
          priority,
          submitted_by: client.userId,
          status: 'submitted'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create roadmap item: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        roadmapItem: data[0],
        message: `Roadmap item "${title}" created successfully`
      };
    }

    case 'read': {
      const { id } = params;
      if (!id) throw new Error('Roadmap item ID is required for read operation');

      const response = await fetch(
        `${client.supabaseUrl}/rest/v1/roadmap_suggestions?id=eq.${id}&limit=1`,
        {
          headers: {
            'apikey': client.supabaseKey,
            'Authorization': `Bearer ${client.supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch roadmap item: ${response.status}`);
      }

      const data = await response.json() as any[];
      if (data.length === 0) {
        throw new Error('Roadmap item not found');
      }

      return {
        success: true,
        roadmapItem: data[0]
      };
    }

    case 'update': {
      const { id, ...updates } = params;
      if (!id) throw new Error('Roadmap item ID is required for update operation');

      // Users can only update their own items
      const response = await fetch(`${client.supabaseUrl}/rest/v1/roadmap_suggestions?id=eq.${id}&submitted_by=eq.${client.userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update roadmap item: ${response.status} ${error}`);
      }

      const data = await response.json() as any[];
      return {
        success: true,
        roadmapItem: data[0],
        message: 'Roadmap item updated successfully'
      };
    }

    case 'delete': {
      const { id } = params;
      if (!id) throw new Error('Roadmap item ID is required for delete operation');

      const response = await fetch(`${client.supabaseUrl}/rest/v1/roadmap_suggestions?id=eq.${id}&submitted_by=eq.${client.userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete roadmap item: ${response.status} ${error}`);
      }

      return {
        success: true,
        message: 'Roadmap item deleted successfully'
      };
    }

    case 'search': {
      const { type_filter, status_filter, priority_filter, sortBy = 'created_at', sortOrder = 'desc', limit = 50 } = params;

      let queryUrl = `${client.supabaseUrl}/rest/v1/roadmap_suggestions?select=*&order=${sortBy}.${sortOrder}&limit=${limit}`;

      if (type_filter) queryUrl += `&type=eq.${type_filter}`;
      if (status_filter) queryUrl += `&status=eq.${status_filter}`;
      if (priority_filter) queryUrl += `&priority=eq.${priority_filter}`;

      const response = await fetch(queryUrl, {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search roadmap items: ${response.status}`);
      }

      const items = await response.json() as any[];

      // Group by status, type, priority
      const byStatus = items.reduce((acc, item) => {
        const status = item.status || 'submitted';
        if (!acc[status]) acc[status] = [];
        acc[status].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      const byType = items.reduce((acc, item) => {
        const type = item.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
        return acc;
      }, {} as Record<string, any[]>);

      return {
        success: true,
        items: items.map((item: any) => ({
          id: item.id,
          ticketId: item.ticket_id,
          title: item.title,
          description: item.description,
          type: item.type,
          priority: item.priority,
          status: item.status,
          votesCount: item.votes_count || 0,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        })),
        summary: {
          byStatus: {
            submitted: (byStatus.submitted || []).length,
            under_review: (byStatus.under_review || []).length,
            in_progress: (byStatus.in_progress || []).length,
            testing: (byStatus.testing || []).length,
            completed: (byStatus.completed || []).length,
            rejected: (byStatus.rejected || []).length
          },
          byType: {
            feature: (byType.feature || []).length,
            bug: (byType.bug || []).length,
            improvement: (byType.improvement || []).length,
            other: (byType.other || []).length
          }
        },
        count: items.length,
        message: `Found ${items.length} roadmap items. ${(byStatus.in_progress || []).length} in progress, ${(byStatus.completed || []).length} completed.`
      };
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Summarize meetings for a period
 */
async function executeSummarizeMeetings(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { period = 'week', startDate, endDate, includeActionItems = true } = args;

  // Calculate date range
  let start: Date;
  let end: Date = new Date();

  if (period === 'week') {
    start = new Date();
    start.setDate(start.getDate() - 7);
  } else if (period === 'month') {
    start = new Date();
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'custom' && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    throw new Error('Invalid period or missing dates for custom period');
  }

  // Fetch meetings
  const response = await fetch(
    `${client.supabaseUrl}/rest/v1/meetings?owner_user_id=eq.${client.userId}&meeting_start=gte.${start.toISOString()}&meeting_start=lte.${end.toISOString()}&select=*&order=meeting_start.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch meetings: ${response.status}`);
  }

  const meetings = await response.json() as any[];

  // Fetch action items if requested
  let actionItems: any[] = [];
  if (includeActionItems && meetings.length > 0) {
    const meetingIds = meetings.map((m: any) => m.id).join(',');
    const actionItemsResponse = await fetch(
      `${client.supabaseUrl}/rest/v1/meeting_action_items?meeting_id=in.(${meetingIds})&select=*`,
      {
        headers: {
          'apikey': client.supabaseKey,
          'Authorization': `Bearer ${client.supabaseKey}`
        }
      }
    );

    if (actionItemsResponse.ok) {
      actionItems = await actionItemsResponse.json() as any[];
    }
  }

  // Generate summary
  const summary = {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      type: period
    },
    totalMeetings: meetings.length,
    meetings: meetings.map((m: any) => ({
      id: m.id,
      title: m.title,
      date: m.meeting_start,
      duration: m.duration_minutes,
      summary: m.summary,
      sentiment: m.sentiment_score,
      actionItemsCount: actionItems.filter(ai => ai.meeting_id === m.id).length
    })),
    totalActionItems: actionItems.length,
    actionItems: includeActionItems ? actionItems.map((ai: any) => ({
      id: ai.id,
      title: ai.title,
      assignee: ai.assignee_name,
      completed: ai.completed,
      deadline: ai.deadline_at
    })) : [],
    summary: `Found ${meetings.length} meetings in the ${period}. ${actionItems.length} action items identified.`
  };

  return summary;
}

/**
 * Find coldest deals
 */
async function executeFindColdestDeals(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { limit = 10, minDaysSinceUpdate = 7, includeStale = true } = args;

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - minDaysSinceUpdate);

  // Fetch deals with low engagement
  const response = await fetch(
    `${client.supabaseUrl}/rest/v1/deals?owner_id=eq.${client.userId}&status=eq.active&select=id,name,value,stage_id,updated_at,created_at,health_score,risk_level,deal_stages(name)&order=updated_at.asc&limit=${limit}`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch deals: ${response.status}`);
  }

  let deals = await response.json() as any[];

  // Filter by update date if requested
  if (includeStale) {
    deals = deals.filter((deal: any) => {
      const updatedAt = new Date(deal.updated_at);
      return updatedAt < cutoffDate;
    });
  }

  // Fetch recent activities for each deal to calculate engagement
  const dealIds = deals.map((d: any) => d.id).join(',');
  const activitiesResponse = dealIds ? await fetch(
    `${client.supabaseUrl}/rest/v1/activities?deal_id=in.(${dealIds})&select=deal_id,date,type&order=date.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  ) : null;

  let activities: any[] = [];
  if (activitiesResponse?.ok) {
    activities = await activitiesResponse.json() as any[];
  }

  // Calculate coldness score for each deal
  const dealsWithScores = deals.map((deal: any) => {
    const dealActivities = activities.filter(a => a.deal_id === deal.id);
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const lastActivityDays = dealActivities.length > 0
      ? Math.floor((Date.now() - new Date(dealActivities[0].date).getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceCreated;

    // Coldness score: higher = colder
    const coldnessScore = 
      (daysSinceUpdate * 0.4) +
      (lastActivityDays * 0.4) +
      ((deal.health_score ? (100 - deal.health_score) : 50) * 0.2);

    return {
      ...deal,
      daysSinceUpdate,
      daysSinceCreated,
      lastActivityDays,
      activityCount: dealActivities.length,
      coldnessScore: Math.round(coldnessScore),
      stage: deal.deal_stages?.name || 'Unknown'
    };
  });

  // Sort by coldness score (highest first)
  dealsWithScores.sort((a: any, b: any) => b.coldnessScore - a.coldnessScore);

  return {
    totalFound: dealsWithScores.length,
    deals: dealsWithScores.slice(0, limit).map((deal: any) => ({
      id: deal.id,
      name: deal.name,
      value: deal.value,
      stage: deal.stage,
      daysSinceUpdate: deal.daysSinceUpdate,
      lastActivityDays: deal.lastActivityDays,
      activityCount: deal.activityCount,
      coldnessScore: deal.coldnessScore,
      healthScore: deal.health_score,
      riskLevel: deal.risk_level
    })),
    summary: `Found ${dealsWithScores.length} cold deals. Top ${Math.min(limit, dealsWithScores.length)} are listed.`
  };
}

/**
 * Find at-risk deals
 */
async function executeFindAtRiskDeals(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const {
    limit = 20,
    minRiskLevel = 'medium',
    maxHealthScore = 60,
    includeHighValue = false,
    minDealValue = 0
  } = args;

  // Risk level priority mapping
  const riskLevelPriority: Record<string, number> = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4
  };

  const minPriority = riskLevelPriority[minRiskLevel] || 2;

  // Fetch all active deals
  const dealsResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/deals?owner_id=eq.${client.userId}&status=eq.active&select=id,name,value,stage_id,status,created_at,updated_at,health_score,risk_level,expected_close_date,deal_stages(name)&order=value.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  if (!dealsResponse.ok) {
    throw new Error(`Failed to fetch deals: ${dealsResponse.status}`);
  }

  let deals = await dealsResponse.json() as any[];

  // Filter deals based on risk criteria
  const atRiskDeals = deals.filter((deal: any) => {
    const dealRiskPriority = riskLevelPriority[deal.risk_level || 'low'] || 1;
    const healthScore = deal.health_score || 100;
    const dealValue = deal.value || 0;

    // Check if deal meets risk criteria
    const meetsRiskLevel = dealRiskPriority >= minPriority;
    const meetsHealthScore = healthScore <= maxHealthScore;
    const meetsValueThreshold = dealValue >= minDealValue;

    // Include if:
    // 1. Meets risk level AND health score criteria, OR
    // 2. High value deal and includeHighValue is true
    return (
      (meetsRiskLevel && meetsHealthScore && meetsValueThreshold) ||
      (includeHighValue && dealValue >= 10000 && meetsValueThreshold)
    );
  });

  // Calculate additional risk metrics for each deal
  const dealsWithRiskMetrics = atRiskDeals.map((deal: any) => {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate risk score (higher = more at risk)
    const riskScore = 
      (riskLevelPriority[deal.risk_level || 'low'] || 1) * 25 +
      (100 - (deal.health_score || 100)) * 0.5 +
      Math.min(daysSinceUpdate / 30, 1) * 25;

    return {
      ...deal,
      daysSinceUpdate,
      daysSinceCreated,
      riskScore: Math.round(riskScore),
      stage: deal.deal_stages?.name || 'Unknown',
      daysUntilClose: deal.expected_close_date
        ? Math.floor((new Date(deal.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null
    };
  });

  // Sort by risk score (highest first)
  dealsWithRiskMetrics.sort((a: any, b: any) => b.riskScore - a.riskScore);

  // Group by risk level
  const byRiskLevel = dealsWithRiskMetrics.reduce((acc, deal) => {
    const level = deal.risk_level || 'low';
    if (!acc[level]) acc[level] = [];
    acc[level].push(deal);
    return acc;
  }, {} as Record<string, any[]>);

  return {
    totalFound: dealsWithRiskMetrics.length,
    deals: dealsWithRiskMetrics.slice(0, limit).map((deal: any) => ({
      id: deal.id,
      name: deal.name,
      value: deal.value,
      stage: deal.stage,
      riskLevel: deal.risk_level || 'low',
      healthScore: deal.health_score,
      riskScore: deal.riskScore,
      daysSinceUpdate: deal.daysSinceUpdate,
      daysUntilClose: deal.daysUntilClose,
      updatedAt: deal.updated_at
    })),
    byRiskLevel: {
      critical: (byRiskLevel.critical || []).length,
      high: (byRiskLevel.high || []).length,
      medium: (byRiskLevel.medium || []).length,
      low: (byRiskLevel.low || []).length
    },
    summary: `Found ${dealsWithRiskMetrics.length} at-risk deals. ${(byRiskLevel.critical || []).length} critical, ${(byRiskLevel.high || []).length} high risk. Top ${Math.min(limit, dealsWithRiskMetrics.length)} are listed.`
  };
}

/**
 * Write impactful emails
 */
async function executeWriteImpactfulEmails(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { focus = 'all', tone = 'professional', maxEmails = 5 } = args;

  // First, identify high-impact opportunities
  const dealsResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/deals?owner_id=eq.${client.userId}&status=eq.active&select=id,name,value,primary_contact_id,health_score,risk_level,updated_at,contacts:primary_contact_id(id,first_name,last_name,email,company_id,companies:company_id(name))&order=value.desc&limit=20`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  if (!dealsResponse.ok) {
    throw new Error(`Failed to fetch deals: ${dealsResponse.status}`);
  }

  let deals = await dealsResponse.json() as any[];

  // Filter based on focus
  if (focus === 'cold_deals') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    deals = deals.filter((d: any) => new Date(d.updated_at) < cutoffDate);
  } else if (focus === 'high_value') {
    deals = deals.filter((d: any) => d.value >= 50000);
  } else if (focus === 'at_risk') {
    deals = deals.filter((d: any) => d.risk_level === 'high' || d.risk_level === 'critical');
  }

  // Sort by impact score
  deals = deals.map((deal: any) => {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const impactScore = (deal.value * 0.5) + ((deal.health_score || 50) * 0.3) + (Math.max(0, 30 - daysSinceUpdate) * 0.2);
    return { ...deal, impactScore };
  });

  deals.sort((a: any, b: any) => b.impactScore - a.impactScore);

  // Select top deals for emails
  const topDeals = deals.slice(0, maxEmails).filter((d: any) => d.contacts);

  // Generate email drafts (this would call Claude API in production)
  const emails = topDeals.map((deal: any, index: number) => {
    const contact = deal.contacts;
    const companyName = contact.companies?.name || 'their company';
    const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

    return {
      rank: index + 1,
      contactId: contact.id,
      contactName,
      contactEmail: contact.email,
      dealId: deal.id,
      dealName: deal.name,
      dealValue: deal.value,
      companyName,
      impactScore: Math.round(deal.impactScore),
      suggestedSubject: `Following up on ${deal.name}`,
      suggestedBody: `Hi ${contactName},\n\nI wanted to follow up on ${deal.name} and see how things are progressing. I'm here to help move this forward.\n\nBest regards`,
      tone,
      priority: deal.health_score < 50 ? 'high' : 'medium'
    };
  });

  return {
    totalGenerated: emails.length,
    emails,
    summary: `Generated ${emails.length} high-impact email suggestions based on deal priorities and engagement levels.`
  };
}

/**
 * Get performance analytics for a time period
 */
async function executeGetPerformanceAnalytics(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { days, startDate, endDate } = args;
  
  // Validate days parameter
  if (!days && !startDate) {
    throw new Error('Either days or startDate must be provided');
  }
  
  if (days && (days < 1 || days > 3650)) {
    throw new Error('Days must be between 1 and 3650 (10 years)');
  }

  // Calculate date range
  let start: Date;
  let end: Date = new Date();
  end.setHours(23, 59, 59, 999); // End of today

  if (startDate && endDate) {
    // Custom date range provided
    start = new Date(startDate);
    end = new Date(endDate);
  } else if (startDate) {
    // Only start date provided, end is today
    start = new Date(startDate);
  } else if (days) {
    // Days parameter provided
    start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
  } else {
    throw new Error('Either days or startDate must be provided');
  }

  // Fetch deals created or updated in the period
  const dealsResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/deals?owner_id=eq.${client.userId}&status=neq.deleted&or=(created_at.gte.${start.toISOString()},updated_at.gte.${start.toISOString()})&select=id,name,value,stage_id,status,created_at,updated_at,one_off_revenue,monthly_mrr,deal_stages(name)&order=created_at.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  if (!dealsResponse.ok) {
    throw new Error(`Failed to fetch deals: ${dealsResponse.status}`);
  }

  const deals = await dealsResponse.json() as any[];

  // Fetch activities in the period
  const activitiesResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/activities?user_id=eq.${client.userId}&date=gte.${start.toISOString().split('T')[0]}&date=lte.${end.toISOString().split('T')[0]}&select=id,type,date,status,amount&order=date.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  let activities: any[] = [];
  if (activitiesResponse.ok) {
    activities = await activitiesResponse.json() as any[];
  }

  // Fetch meetings in the period
  const meetingsResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/meetings?owner_user_id=eq.${client.userId}&meeting_start=gte.${start.toISOString()}&meeting_start=lte.${end.toISOString()}&select=id,title,meeting_start,duration_minutes,status&order=meeting_start.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  let meetings: any[] = [];
  if (meetingsResponse.ok) {
    meetings = await meetingsResponse.json() as any[];
  }

  // Fetch tasks created in the period
  const tasksResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/tasks?assigned_to=eq.${client.userId}&created_at=gte.${start.toISOString()}&select=id,title,status,priority,due_date,created_at&order=created_at.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  let tasks: any[] = [];
  if (tasksResponse.ok) {
    tasks = await tasksResponse.json() as any[];
  }

  // Calculate metrics
  const totalDealValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const signedDeals = deals.filter(d => d.deal_stages?.name?.toLowerCase().includes('signed') || d.status === 'won');
  const signedDealValue = signedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const oneOffRevenue = deals.reduce((sum, d) => sum + (d.one_off_revenue || 0), 0);
  const monthlyMRR = deals.reduce((sum, d) => sum + (d.monthly_mrr || 0), 0);
  const annualValue = (monthlyMRR * 12) + oneOffRevenue;

  // Group activities by type
  const activitiesByType = activities.reduce((acc, a) => {
    const type = a.type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate task completion
  const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress').length;

  // Calculate meeting metrics
  const completedMeetings = meetings.filter(m => m.status === 'completed' || m.status === 'done').length;
  const totalMeetingMinutes = meetings.reduce((sum, m) => sum + (m.duration_minutes || 0), 0);

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    },
    deals: {
      total: deals.length,
      signed: signedDeals.length,
      totalValue: totalDealValue,
      signedValue: signedDealValue,
      averageDealSize: deals.length > 0 ? totalDealValue / deals.length : 0,
      conversionRate: deals.length > 0 ? (signedDeals.length / deals.length) * 100 : 0,
      byStage: deals.reduce((acc, d) => {
        const stage = d.deal_stages?.name || 'Unknown';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    revenue: {
      oneOff: oneOffRevenue,
      monthlyMRR: monthlyMRR,
      annualValue: annualValue,
      ltv: (monthlyMRR * 3) + oneOffRevenue
    },
    activities: {
      total: activities.length,
      byType: activitiesByType,
      completed: activities.filter(a => a.status === 'completed').length
    },
    meetings: {
      total: meetings.length,
      completed: completedMeetings,
      totalMinutes: totalMeetingMinutes,
      averageDuration: meetings.length > 0 ? totalMeetingMinutes / meetings.length : 0
    },
    tasks: {
      total: tasks.length,
      completed: completedTasks,
      pending: pendingTasks,
      completionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0
    },
    summary: `Performance over the last ${Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))} days: ${deals.length} deals (${signedDeals.length} signed), $${totalDealValue.toLocaleString()} total value, ${activities.length} activities, ${meetings.length} meetings, ${tasks.length} tasks (${completedTasks} completed).`
  };
}
