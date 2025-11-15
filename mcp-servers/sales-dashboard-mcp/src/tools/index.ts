/**
 * Sales Dashboard MCP Tools
 * Tools for interacting with the sales dashboard CRM system
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export interface SalesDashboardClient {
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
}

/**
 * Create roadmap item tool
 */
export const createRoadmapItemTool: Tool = {
  name: 'create_roadmap_item',
  description: 'Create a new roadmap item (feature, bug, improvement, or other suggestion)',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the roadmap item'
      },
      description: {
        type: 'string',
        description: 'Detailed description of the roadmap item'
      },
      type: {
        type: 'string',
        enum: ['feature', 'bug', 'improvement', 'other'],
        description: 'Type of roadmap item',
        default: 'feature'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Priority level',
        default: 'medium'
      }
    },
    required: ['title', 'description']
  }
};

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
 * Create task tool
 */
export const createTaskTool: Tool = {
  name: 'create_task',
  description: 'Create a new task in the CRM system',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Task title'
      },
      description: {
        type: 'string',
        description: 'Task description'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
        description: 'Task priority',
        default: 'medium'
      },
      taskType: {
        type: 'string',
        enum: ['call', 'email', 'meeting', 'follow_up', 'demo', 'proposal', 'general'],
        description: 'Type of task',
        default: 'general'
      },
      dueDate: {
        type: 'string',
        description: 'Due date in ISO format'
      },
      contactId: {
        type: 'string',
        description: 'Contact ID to link the task to'
      },
      dealId: {
        type: 'string',
        description: 'Deal ID to link the task to'
      },
      companyId: {
        type: 'string',
        description: 'Company ID to link the task to'
      }
    },
    required: ['title']
  }
};

/**
 * Write impactful emails tool
 */
export const writeImpactfulEmailsTool: Tool = {
  name: 'write_impactful_emails',
  description: 'Generate 5 high-impact emails for the week based on deal priorities, engagement levels, and sales opportunities',
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

export const SALES_DASHBOARD_TOOLS: Tool[] = [
  createRoadmapItemTool,
  summarizeMeetingsTool,
  findColdestDealsTool,
  createTaskTool,
  writeImpactfulEmailsTool
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
    case 'create_roadmap_item':
      return await executeCreateRoadmapItem(args, client);
    
    case 'summarize_meetings':
      return await executeSummarizeMeetings(args, client);
    
    case 'find_coldest_deals':
      return await executeFindColdestDeals(args, client);
    
    case 'create_task':
      return await executeCreateTask(args, client);
    
    case 'write_impactful_emails':
      return await executeWriteImpactfulEmails(args, client);
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Create a roadmap item
 */
async function executeCreateRoadmapItem(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const { title, description, type = 'feature', priority = 'medium' } = args;

  if (!title || !description) {
    throw new Error('Title and description are required');
  }

  // Call Supabase API to create roadmap item
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

  const data = await response.json();
  return {
    success: true,
    roadmapItem: {
      id: data[0]?.id,
      ticket_id: data[0]?.ticket_id,
      title: data[0]?.title,
      type: data[0]?.type,
      priority: data[0]?.priority,
      status: data[0]?.status
    },
    message: `Roadmap item "${title}" created successfully`
  };
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

  const meetings = await response.json();

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
      actionItems = await actionItemsResponse.json();
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

  let deals = await response.json();

  // Filter by update date if requested
  if (includeStale) {
    deals = deals.filter((deal: any) => {
      const updatedAt = new Date(deal.updated_at);
      return updatedAt < cutoffDate;
    });
  }

  // Fetch recent activities for each deal to calculate engagement
  const dealIds = deals.map((d: any) => d.id).join(',');
  const activitiesResponse = await fetch(
    `${client.supabaseUrl}/rest/v1/activities?deal_id=in.(${dealIds})&select=deal_id,date,type&order=date.desc`,
    {
      headers: {
        'apikey': client.supabaseKey,
        'Authorization': `Bearer ${client.supabaseKey}`
      }
    }
  );

  let activities: any[] = [];
  if (activitiesResponse.ok) {
    activities = await activitiesResponse.json();
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
  dealsWithScores.sort((a, b) => b.coldnessScore - a.coldnessScore);

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
 * Create a task
 */
async function executeCreateTask(
  args: any,
  client: SalesDashboardClient
): Promise<any> {
  const {
    title,
    description = '',
    priority = 'medium',
    taskType = 'general',
    dueDate,
    contactId,
    dealId,
    companyId
  } = args;

  if (!title) {
    throw new Error('Title is required');
  }

  const taskData: any = {
    title,
    description,
    priority,
    task_type: taskType,
    created_by: client.userId,
    assigned_to: client.userId, // Default to creator
    status: 'todo'
  };

  if (dueDate) {
    taskData.due_date = new Date(dueDate).toISOString();
  }

  if (contactId) {
    taskData.contact_id = contactId;
  }

  if (dealId) {
    taskData.deal_id = dealId;
  }

  if (companyId) {
    taskData.company_id = companyId;
  }

  // Call Supabase API to create task
  const response = await fetch(`${client.supabaseUrl}/rest/v1/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': client.supabaseKey,
      'Authorization': `Bearer ${client.supabaseKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create task: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    success: true,
    task: {
      id: data[0]?.id,
      title: data[0]?.title,
      description: data[0]?.description,
      priority: data[0]?.priority,
      status: data[0]?.status,
      dueDate: data[0]?.due_date
    },
    message: `Task "${title}" created successfully`
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

  let deals = await dealsResponse.json();

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

