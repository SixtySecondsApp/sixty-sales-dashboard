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
  category: 'deals' | 'contacts' | 'tasks' | 'activities' | 'analytics' | 'meetings';
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
        name: 'ownerId',
        type: 'string',
        description: 'User ID to assign as deal owner',
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
          user_id: parameters.ownerId || context.userId,
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
      
      // Add CRM links to the results
      // Use the app's base URL - in production this would be your actual domain
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:5173'; // Default for server-side execution
      
      const enhancedData = data?.map((contact: any) => ({
        ...contact,
        crm_link: `${baseUrl}/crm/contacts/${contact.id}`,
        view_url: `${baseUrl}/crm/contacts/${contact.id}`
      })) || [];
      
      return {
        success: true,
        data: enhancedData,
        metadata: {
          recordsAffected: data?.length || 0,
          message: data?.length > 0 
            ? `Found ${data.length} contact(s). Links provided for each record.`
            : 'No contacts found matching the search criteria.',
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
      {
        name: 'assignedTo',
        type: 'string',
        description: 'User ID to assign task to',
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
          assigned_to: parameters.assignedTo || context.userId,
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
 * Tool: Create Contact
 */
export class CreateContactTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_contact',
    displayName: 'Create Contact',
    description: 'Create a new contact in the CRM',
    category: 'contacts',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Contact full name',
        required: true,
      },
      {
        name: 'email',
        type: 'string',
        description: 'Email address',
        required: true,
      },
      {
        name: 'phone',
        type: 'string',
        description: 'Phone number',
        required: false,
      },
      {
        name: 'company',
        type: 'string',
        description: 'Company name',
        required: false,
      },
      {
        name: 'assignedTo',
        type: 'string',
        description: 'User ID to assign contact to',
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
      description: 'Created contact object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: context.userId,
          name: parameters.name,
          email: parameters.email,
          phone: parameters.phone,
          company: parameters.company,
          assigned_to: parameters.assignedTo || context.userId,
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
 * Tool: Create Company
 */
export class CreateCompanyTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_company',
    displayName: 'Create Company',
    description: 'Create a new company in the CRM',
    category: 'contacts',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'Company name',
        required: true,
      },
      {
        name: 'domain',
        type: 'string',
        description: 'Company website domain',
        required: false,
      },
      {
        name: 'industry',
        type: 'string',
        description: 'Industry type',
        required: false,
      },
      {
        name: 'size',
        type: 'string',
        description: 'Company size (1-10, 11-50, etc.)',
        required: false,
      },
      {
        name: 'ownerId',
        type: 'string',
        description: 'User ID to assign as company owner',
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
      description: 'Created company object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: context.userId,
          name: parameters.name,
          domain: parameters.domain,
          industry: parameters.industry,
          size: parameters.size,
          owner_id: parameters.ownerId || context.userId,
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
 * Tool: Search Users
 */
export class SearchUsersTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'search_users',
    displayName: 'Search Users',
    description: 'Search for available users for assignment',
    category: 'contacts',
    parameters: [
      {
        name: 'name',
        type: 'string',
        description: 'User name to search',
        required: false,
      },
      {
        name: 'email',
        type: 'string',
        description: 'Email address to search',
        required: false,
      },
      {
        name: 'isActive',
        type: 'boolean',
        description: 'Only active users',
        required: false,
        default: true,
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
      description: 'Array of available users for assignment',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, stage');
      
      if (parameters.name) {
        query = query.or(`first_name.ilike.%${parameters.name}%,last_name.ilike.%${parameters.name}%`);
      }
      
      if (parameters.email) {
        query = query.ilike('email', `%${parameters.email}%`);
      }
      
      query = query.limit(parameters.limit || 10);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return {
        success: true,
        data: data?.map(user => ({
          id: user.id,
          name: user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}` 
            : user.email,
          email: user.email,
          stage: user.stage,
        })) || [],
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
 * Tool: Create Activity
 */
export class CreateActivityTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_activity',
    displayName: 'Create Activity',
    description: 'Log an activity or note in the CRM',
    category: 'activities',
    parameters: [
      {
        name: 'type',
        type: 'string',
        description: 'Activity type (note, call, meeting, email, proposal)',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Activity description',
        required: true,
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
      {
        name: 'assignedTo',
        type: 'string',
        description: 'User ID to assign activity to',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Created activity object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { data, error } = await supabase
        .from('activities')
        .insert({
          user_id: context.userId,
          type: parameters.type,
          description: parameters.description,
          deal_id: parameters.dealId,
          contact_id: parameters.contactId,
          assigned_to: parameters.assignedTo || context.userId,
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
 * Tool: Assign Owner
 */
export class AssignOwnerTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'assign_owner',
    displayName: 'Assign Owner',
    description: 'Assign or reassign ownership of CRM records',
    category: 'tasks',
    parameters: [
      {
        name: 'recordType',
        type: 'string',
        description: 'Type of record (deal, contact, company, task)',
        required: true,
      },
      {
        name: 'recordId',
        type: 'string',
        description: 'ID of the record to assign',
        required: true,
      },
      {
        name: 'userId',
        type: 'string',
        description: 'User ID to assign as owner',
        required: true,
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Assignment notes',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated record object',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);
      
      const { recordType, recordId, userId, notes } = parameters;
      let tableName: string;
      let ownerField: string;
      
      // Map record types to table names and owner fields
      switch (recordType.toLowerCase()) {
        case 'deal':
          tableName = 'deals';
          ownerField = 'user_id';
          break;
        case 'contact':
          tableName = 'contacts';
          ownerField = 'assigned_to';
          break;
        case 'company':
          tableName = 'companies';
          ownerField = 'owner_id';
          break;
        case 'task':
          tableName = 'tasks';
          ownerField = 'assigned_to';
          break;
        default:
          throw new Error(`Unsupported record type: ${recordType}`);
      }
      
      const { data, error } = await supabase
        .from(tableName)
        .update({
          [ownerField]: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Log the assignment activity
      if (notes) {
        await supabase.from('activities').insert({
          user_id: context.userId,
          type: 'assignment',
          description: `${recordType} assigned to user ${userId}: ${notes}`,
          [`${recordType.toLowerCase()}_id`]: recordId,
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
 * Tool: Create Meeting
 */
export class CreateMeetingTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'create_meeting',
    displayName: 'Create Meeting',
    description: 'Create a new meeting record with Fathom integration',
    category: 'meetings',
    parameters: [
      {
        name: 'title',
        type: 'string',
        description: 'Meeting title',
        required: true,
      },
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID for reference',
        required: true,
      },
      {
        name: 'attendees',
        type: 'array',
        description: 'Array of attendee user IDs or email addresses',
        required: false,
        default: [],
      },
      {
        name: 'scheduledFor',
        type: 'string',
        description: 'Meeting date/time (ISO string)',
        required: true,
      },
      {
        name: 'duration',
        type: 'number',
        description: 'Meeting duration in minutes',
        required: false,
        default: 30,
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
      {
        name: 'assignedTo',
        type: 'string',
        description: 'User ID to assign the meeting to',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Created meeting with ID and details',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const meetingData = {
        user_id: parameters.assignedTo || context.userId,
        title: parameters.title,
        fathom_meeting_id: parameters.fathomMeetingId,
        attendees: parameters.attendees || [],
        scheduled_for: parameters.scheduledFor,
        duration_minutes: parameters.duration || 30,
        deal_id: parameters.dealId || null,
        contact_id: parameters.contactId || null,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single();

      if (error) throw error;

      // Create activity record
      await supabase.from('activities').insert({
        user_id: context.userId,
        type: 'meeting_scheduled',
        description: `Meeting scheduled: ${parameters.title}`,
        deal_id: parameters.dealId || null,
        contact_id: parameters.contactId || null,
        created_at: new Date().toISOString(),
      });

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
 * Tool: Update Meeting
 */
export class UpdateMeetingTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'update_meeting',
    displayName: 'Update Meeting',
    description: 'Update meeting record using Fathom Meeting ID',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'status',
        type: 'string',
        description: 'Meeting status (scheduled, in_progress, completed, cancelled)',
        required: false,
      },
      {
        name: 'actualDuration',
        type: 'number',
        description: 'Actual meeting duration in minutes',
        required: false,
      },
      {
        name: 'notes',
        type: 'string',
        description: 'Meeting notes',
        required: false,
      },
      {
        name: 'outcome',
        type: 'string',
        description: 'Meeting outcome',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting record',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (parameters.status) updateData.status = parameters.status;
      if (parameters.actualDuration) updateData.actual_duration_minutes = parameters.actualDuration;
      if (parameters.notes) updateData.notes = parameters.notes;
      if (parameters.outcome) updateData.outcome = parameters.outcome;

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
      }

      // Create activity record for the update
      if (parameters.status === 'completed') {
        await supabase.from('activities').insert({
          user_id: context.userId,
          type: 'meeting_completed',
          description: `Meeting completed: ${data.title}${parameters.outcome ? ` - ${parameters.outcome}` : ''}`,
          deal_id: data.deal_id || null,
          contact_id: data.contact_id || null,
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
 * Tool: Add Meeting Transcript
 */
export class AddMeetingTranscriptTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_meeting_transcript',
    displayName: 'Add Meeting Transcript',
    description: 'Add transcript to meeting using Google Docs link',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'googleDocsUrl',
        type: 'string',
        description: 'Google Docs URL containing the transcript',
        required: true,
      },
      {
        name: 'transcriptText',
        type: 'string',
        description: 'Full transcript text (optional if using Google Docs)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with transcript information',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const updateData = {
        transcript_google_docs_url: parameters.googleDocsUrl,
        transcript_text: parameters.transcriptText || null,
        has_transcript: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
      }

      // Create activity record
      await supabase.from('activities').insert({
        user_id: context.userId,
        type: 'meeting_transcript_added',
        description: `Transcript added to meeting: ${data.title}`,
        deal_id: data.deal_id || null,
        contact_id: data.contact_id || null,
        created_at: new Date().toISOString(),
      });

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
 * Tool: Add Meeting Summary
 */
export class AddMeetingSummaryTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_meeting_summary',
    displayName: 'Add Meeting Summary',
    description: 'Add summary to meeting record',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'summary',
        type: 'string',
        description: 'Meeting summary text',
        required: true,
      },
      {
        name: 'keyPoints',
        type: 'array',
        description: 'Array of key discussion points',
        required: false,
        default: [],
      },
      {
        name: 'decisions',
        type: 'array',
        description: 'Array of decisions made',
        required: false,
        default: [],
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with summary information',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const updateData = {
        summary: parameters.summary,
        key_points: parameters.keyPoints || [],
        decisions: parameters.decisions || [],
        has_summary: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
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
 * Tool: Add Meeting Tasks
 */
export class AddMeetingTasksTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_meeting_tasks',
    displayName: 'Add Meeting Tasks',
    description: 'Add tasks discussed in meeting',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'tasks',
        type: 'array',
        description: 'Array of tasks with title, assignee, due_date',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Created tasks and updated meeting',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      // Get meeting details
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .single();

      if (meetingError) throw meetingError;

      if (!meeting) {
        throw new Error('Meeting not found or access denied');
      }

      const createdTasks = [];

      // Create each task
      for (const task of parameters.tasks) {
        const taskData = {
          user_id: task.assignee || context.userId,
          title: task.title,
          description: `Task from meeting: ${meeting.title}`,
          due_date: task.due_date || null,
          priority: task.priority || 'medium',
          status: 'pending',
          deal_id: meeting.deal_id || null,
          contact_id: meeting.contact_id || null,
          meeting_id: meeting.id,
          created_at: new Date().toISOString(),
        };

        const { data: createdTask, error: taskError } = await supabase
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (taskError) throw taskError;
        createdTasks.push(createdTask);
      }

      // Update meeting with task count
      await supabase
        .from('meetings')
        .update({
          tasks_count: createdTasks.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', meeting.id);

      return {
        success: true,
        data: {
          meeting,
          tasks: createdTasks,
        },
        metadata: {
          recordsAffected: createdTasks.length + 1,
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
 * Tool: Add Meeting Next Steps
 */
export class AddMeetingNextStepsTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_meeting_next_steps',
    displayName: 'Add Meeting Next Steps',
    description: 'Add next steps to meeting record',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'nextSteps',
        type: 'array',
        description: 'Array of next steps with description and owner',
        required: true,
      },
      {
        name: 'followUpDate',
        type: 'string',
        description: 'Follow-up date (ISO string)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with next steps',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const updateData = {
        next_steps: parameters.nextSteps,
        follow_up_date: parameters.followUpDate || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
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
 * Tool: Add Coaching Summary
 */
export class AddCoachingSummaryTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_coaching_summary',
    displayName: 'Add Coaching Summary',
    description: 'Add coaching analysis to meeting',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'coachingSummary',
        type: 'string',
        description: 'Coaching feedback and analysis',
        required: true,
      },
      {
        name: 'strengths',
        type: 'array',
        description: 'Array of identified strengths',
        required: false,
        default: [],
      },
      {
        name: 'improvementAreas',
        type: 'array',
        description: 'Array of areas for improvement',
        required: false,
        default: [],
      },
      {
        name: 'coachingNotes',
        type: 'string',
        description: 'Additional coaching notes',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with coaching summary',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      const updateData = {
        coaching_summary: parameters.coachingSummary,
        coaching_strengths: parameters.strengths || [],
        coaching_improvement_areas: parameters.improvementAreas || [],
        coaching_notes: parameters.coachingNotes || null,
        has_coaching_summary: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
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
 * Tool: Add Coaching Rating
 */
export class AddCoachingRatingTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_coaching_rating',
    displayName: 'Add Coaching Rating',
    description: 'Add performance rating to meeting',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'overallRating',
        type: 'number',
        description: 'Overall performance rating (1-10)',
        required: true,
      },
      {
        name: 'communicationRating',
        type: 'number',
        description: 'Communication rating (1-10)',
        required: false,
      },
      {
        name: 'knowledgeRating',
        type: 'number',
        description: 'Product knowledge rating (1-10)',
        required: false,
      },
      {
        name: 'closingRating',
        type: 'number',
        description: 'Closing skills rating (1-10)',
        required: false,
      },
      {
        name: 'ratingNotes',
        type: 'string',
        description: 'Notes explaining the ratings',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with coaching rating',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      // Validate rating ranges
      const ratings = [
        parameters.overallRating,
        parameters.communicationRating,
        parameters.knowledgeRating,
        parameters.closingRating,
      ].filter(r => r !== undefined);

      for (const rating of ratings) {
        if (rating < 1 || rating > 10) {
          throw new Error('Ratings must be between 1 and 10');
        }
      }

      const updateData = {
        coaching_overall_rating: parameters.overallRating,
        coaching_communication_rating: parameters.communicationRating || null,
        coaching_knowledge_rating: parameters.knowledgeRating || null,
        coaching_closing_rating: parameters.closingRating || null,
        coaching_rating_notes: parameters.ratingNotes || null,
        has_coaching_rating: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
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
 * Tool: Add Talk Time Percentage
 */
export class AddTalkTimePercentageTool extends CRMTool {
  definition: ToolDefinition = {
    name: 'add_talk_time_percentage',
    displayName: 'Add Talk Time Percentage',
    description: 'Add talk time analysis to meeting',
    category: 'meetings',
    parameters: [
      {
        name: 'fathomMeetingId',
        type: 'string',
        description: 'Fathom Meeting ID to identify the meeting',
        required: true,
      },
      {
        name: 'salesRepTalkTime',
        type: 'number',
        description: 'Sales rep talk time percentage (0-100)',
        required: true,
      },
      {
        name: 'prospectTalkTime',
        type: 'number',
        description: 'Prospect talk time percentage (0-100)',
        required: true,
      },
      {
        name: 'talkTimeAnalysis',
        type: 'string',
        description: 'Analysis of talk time distribution',
        required: false,
      },
      {
        name: 'talkTimeRecommendations',
        type: 'string',
        description: 'Recommendations for improvement',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Updated meeting with talk time data',
    },
  };

  async execute(
    parameters: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParameters(parameters);

      // Validate percentages
      if (parameters.salesRepTalkTime < 0 || parameters.salesRepTalkTime > 100) {
        throw new Error('Sales rep talk time must be between 0 and 100');
      }
      if (parameters.prospectTalkTime < 0 || parameters.prospectTalkTime > 100) {
        throw new Error('Prospect talk time must be between 0 and 100');
      }

      const updateData = {
        sales_rep_talk_time_percentage: parameters.salesRepTalkTime,
        prospect_talk_time_percentage: parameters.prospectTalkTime,
        talk_time_analysis: parameters.talkTimeAnalysis || null,
        talk_time_recommendations: parameters.talkTimeRecommendations || null,
        has_talk_time_data: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('fathom_meeting_id', parameters.fathomMeetingId)
        .eq('user_id', context.userId)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Meeting not found or access denied');
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
    // Deals
    this.registerTool(new SearchDealsTool());
    this.registerTool(new CreateDealTool());
    this.registerTool(new UpdateDealStageTool());
    
    // Contacts & Companies
    this.registerTool(new SearchContactsTool());
    this.registerTool(new CreateContactTool());
    this.registerTool(new CreateCompanyTool());
    
    // Tasks & Activities
    this.registerTool(new CreateTaskTool());
    this.registerTool(new CreateActivityTool());
    
    // User Management
    this.registerTool(new SearchUsersTool());
    this.registerTool(new AssignOwnerTool());
    
    // Analytics
    this.registerTool(new GetDealAnalyticsTool());
    
    // Meetings
    this.registerTool(new CreateMeetingTool());
    this.registerTool(new UpdateMeetingTool());
    this.registerTool(new AddMeetingTranscriptTool());
    this.registerTool(new AddMeetingSummaryTool());
    this.registerTool(new AddMeetingTasksTool());
    this.registerTool(new AddMeetingNextStepsTool());
    this.registerTool(new AddCoachingSummaryTool());
    this.registerTool(new AddCoachingRatingTool());
    this.registerTool(new AddTalkTimePercentageTool());
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