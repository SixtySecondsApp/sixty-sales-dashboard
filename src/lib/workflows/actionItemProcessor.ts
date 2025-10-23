// Enhanced Action Item Processor for Fathom Meeting Workflows
// Processes Fathom action items with role categorization, smart deadlines, and sales workflow integration

import { Task } from '../database/models';

export interface FathomActionItem {
  text: string;
  assignee?: string;
  due_date?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  category?: string;
  context?: string;
}

export interface ProcessingConfig {
  // Role-based categorization
  roleCategorization?: {
    enabled: boolean;
    salesRepKeywords: string[];
    clientKeywords: string[];
    defaultAssignee: 'sales_rep' | 'client' | 'system';
  };
  
  // Smart deadline calculation
  deadlineRules?: {
    enabled: boolean;
    urgentDays: number;
    highDays: number;
    mediumDays: number;
    lowDays: number;
    accountForWeekends: boolean;
    accountForHolidays: boolean;
  };
  
  // Task assignment logic
  assignmentRules?: {
    enabled: boolean;
    defaultSalesRep?: string;
    autoAssignToMeetingOwner: boolean;
    escalationRules: {
      urgentTasks: string[];
      highValueDeals: string[];
    };
  };
  
  // Sales workflow integration
  salesWorkflow?: {
    enabled: boolean;
    createFollowUpTasks: boolean;
    linkToDeals: boolean;
    updateDealStage: boolean;
    generateProposalTasks: boolean;
    trackClientEngagement: boolean;
  };
}

export interface ProcessedActionItem extends FathomActionItem {
  id: string;
  role_category: 'sales_rep' | 'client' | 'system';
  calculated_due_date: string;
  assigned_to: string;
  task_type: Task['task_type'];
  sales_context: {
    is_sales_task: boolean;
    deal_id?: string;
    follow_up_required: boolean;
    client_engagement_level: 'high' | 'medium' | 'low';
    proposal_related: boolean;
  };
}

export interface MeetingContext {
  meeting_id: string;
  owner_user_id: string;
  participants: Array<{
    name: string;
    email: string;
    role: 'host' | 'guest';
  }>;
  deal_id?: string;
  company_name?: string;
  meeting_type?: 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'closing';
}

/**
 * Default configuration for the Action Item Processor
 */
export const defaultProcessingConfig: ProcessingConfig = {
  roleCategorization: {
    enabled: true,
    salesRepKeywords: [
      'send proposal', 'follow up', 'prepare quote', 'schedule demo',
      'update crm', 'send contract', 'follow up with', 'reach out to',
      'send pricing', 'prepare presentation', 'book meeting', 'call client',
      'email proposal', 'draft agreement', 'review contract', 'send follow-up'
    ],
    clientKeywords: [
      'review proposal', 'sign contract', 'provide feedback', 'approve budget',
      'get approval', 'check with team', 'review internally', 'confirm timeline',
      'validate requirements', 'test solution', 'provide access', 'share documents',
      'schedule with team', 'get stakeholder approval', 'review pricing'
    ],
    defaultAssignee: 'sales_rep'
  },
  deadlineRules: {
    enabled: true,
    urgentDays: 1,
    highDays: 3,
    mediumDays: 7,
    lowDays: 14,
    accountForWeekends: true,
    accountForHolidays: false
  },
  assignmentRules: {
    enabled: true,
    autoAssignToMeetingOwner: true,
    escalationRules: {
      urgentTasks: ['manager@company.com'],
      highValueDeals: ['sales-director@company.com']
    }
  },
  salesWorkflow: {
    enabled: true,
    createFollowUpTasks: true,
    linkToDeals: true,
    updateDealStage: false,
    generateProposalTasks: true,
    trackClientEngagement: true
  }
};

/**
 * Categorizes action items based on role (sales rep vs client tasks)
 */
export function categorizeByRole(
  actionItem: FathomActionItem,
  config: ProcessingConfig['roleCategorization']
): 'sales_rep' | 'client' | 'system' {
  if (!config?.enabled) {
    return config?.defaultAssignee || 'sales_rep';
  }

  const text = actionItem.text.toLowerCase();
  
  // Check for sales rep keywords
  const hasSalesKeywords = config.salesRepKeywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
  
  // Check for client keywords
  const hasClientKeywords = config.clientKeywords.some(keyword => 
    text.includes(keyword.toLowerCase())
  );
  
  if (hasSalesKeywords && !hasClientKeywords) {
    return 'sales_rep';
  } else if (hasClientKeywords && !hasSalesKeywords) {
    return 'client';
  } else if (hasSalesKeywords && hasClientKeywords) {
    // Both types detected, use context or default to sales rep
    return 'sales_rep';
  }
  
  return config.defaultAssignee || 'system';
}

/**
 * Calculates smart deadlines based on priority and business rules
 */
export function calculateDeadline(
  priority: FathomActionItem['priority'],
  config: ProcessingConfig['deadlineRules'],
  baseDate: Date = new Date()
): string {
  if (!config?.enabled) {
    // Default fallback: 3 days for high priority, 7 days otherwise
    const defaultDays = priority === 'urgent' || priority === 'high' ? 3 : 7;
    const deadline = new Date(baseDate);
    deadline.setDate(deadline.getDate() + defaultDays);
    return deadline.toISOString();
  }

  let daysToAdd: number;
  switch (priority) {
    case 'urgent':
      daysToAdd = config.urgentDays;
      break;
    case 'high':
      daysToAdd = config.highDays;
      break;
    case 'medium':
      daysToAdd = config.mediumDays;
      break;
    case 'low':
      daysToAdd = config.lowDays;
      break;
    default:
      daysToAdd = config.mediumDays; // Default to medium priority
  }

  const deadline = new Date(baseDate);
  let currentDate = new Date(baseDate);
  let addedDays = 0;

  while (addedDays < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Skip weekends if configured
    if (config.accountForWeekends) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday = 0, Saturday = 6
        continue;
      }
    }
    
    // Skip holidays if configured (basic implementation - could be enhanced)
    if (config.accountForHolidays) {
      if (isHoliday(currentDate)) {
        continue;
      }
    }
    
    addedDays++;
  }

  return currentDate.toISOString();
}

/**
 * Determines task assignment based on role category and assignment rules
 */
export function determineAssignment(
  actionItem: FathomActionItem,
  roleCategory: 'sales_rep' | 'client' | 'system',
  meetingContext: MeetingContext,
  config: ProcessingConfig['assignmentRules']
): string {
  if (!config?.enabled) {
    return actionItem.assignee || meetingContext.owner_user_id;
  }

  // If explicitly assigned, use that
  if (actionItem.assignee) {
    return actionItem.assignee;
  }

  // Auto-assign to meeting owner for sales rep tasks
  if (roleCategory === 'sales_rep' && config.autoAssignToMeetingOwner) {
    return meetingContext.owner_user_id;
  }

  // Handle escalation for urgent tasks
  if (actionItem.priority === 'urgent' && config.escalationRules.urgentTasks.length > 0) {
    return config.escalationRules.urgentTasks[0];
  }

  // Default fallback
  return config.defaultSalesRep || meetingContext.owner_user_id;
}

/**
 * Determines the appropriate task type based on action item content
 */
export function determineTaskType(
  actionItem: FathomActionItem,
  roleCategory: 'sales_rep' | 'client' | 'system'
): Task['task_type'] {
  const text = actionItem.text.toLowerCase();

  // Proposal-related tasks
  if (text.includes('proposal') || text.includes('quote') || text.includes('pricing')) {
    return 'proposal';
  }

  // Demo-related tasks
  if (text.includes('demo') || text.includes('presentation') || text.includes('show')) {
    return 'demo';
  }

  // Meeting-related tasks
  if (text.includes('meeting') || text.includes('call') || text.includes('schedule')) {
    return 'meeting';
  }

  // Email-related tasks
  if (text.includes('email') || text.includes('send') || text.includes('forward')) {
    return 'email';
  }

  // Call-related tasks
  if (text.includes('call') || text.includes('phone') || text.includes('reach out')) {
    return 'call';
  }

  // Follow-up tasks
  if (text.includes('follow up') || text.includes('follow-up') || text.includes('check in')) {
    return 'follow_up';
  }

  // Default to general
  return 'general';
}

/**
 * Analyzes sales context for the action item
 */
export function analyzeSalesContext(
  actionItem: FathomActionItem,
  roleCategory: 'sales_rep' | 'client' | 'system',
  meetingContext: MeetingContext,
  config: ProcessingConfig['salesWorkflow']
): ProcessedActionItem['sales_context'] {
  const text = actionItem.text.toLowerCase();
  
  const isSalesTask = roleCategory === 'sales_rep';
  const proposalRelated = text.includes('proposal') || text.includes('quote') || text.includes('pricing');
  
  // Determine client engagement level based on task content
  let clientEngagementLevel: 'high' | 'medium' | 'low' = 'medium';
  
  if (text.includes('urgent') || text.includes('asap') || actionItem.priority === 'urgent') {
    clientEngagementLevel = 'high';
  } else if (text.includes('when convenient') || actionItem.priority === 'low') {
    clientEngagementLevel = 'low';
  }

  const followUpRequired = config?.createFollowUpTasks && (
    proposalRelated || 
    text.includes('follow up') || 
    roleCategory === 'client'
  );

  return {
    is_sales_task: isSalesTask,
    deal_id: meetingContext.deal_id,
    follow_up_required: followUpRequired,
    client_engagement_level: clientEngagementLevel,
    proposal_related: proposalRelated
  };
}

/**
 * Main processing function that orchestrates all the enhancements
 */
export function processActionItems(
  actionItems: FathomActionItem[],
  meetingContext: MeetingContext,
  config: ProcessingConfig = defaultProcessingConfig
): ProcessedActionItem[] {
  return actionItems.map((item, index) => {
    // Step 1: Categorize by role
    const roleCategory = categorizeByRole(item, config.roleCategorization);
    
    // Step 2: Calculate smart deadline
    const calculatedDueDate = calculateDeadline(item.priority, config.deadlineRules);
    
    // Step 3: Determine assignment
    const assignedTo = determineAssignment(item, roleCategory, meetingContext, config.assignmentRules);
    
    // Step 4: Determine task type
    const taskType = determineTaskType(item, roleCategory);
    
    // Step 5: Analyze sales context
    const salesContext = analyzeSalesContext(item, roleCategory, meetingContext, config.salesWorkflow);
    
    return {
      ...item,
      id: `action_${meetingContext.meeting_id}_${index}`,
      role_category: roleCategory,
      calculated_due_date: calculatedDueDate,
      assigned_to: assignedTo,
      task_type: taskType,
      sales_context: salesContext
    };
  });
}

/**
 * Generates follow-up tasks based on processed action items
 */
export function generateFollowUpTasks(
  processedItems: ProcessedActionItem[],
  meetingContext: MeetingContext,
  config: ProcessingConfig['salesWorkflow']
): Partial<Task>[] {
  if (!config?.createFollowUpTasks) {
    return [];
  }

  const followUpTasks: Partial<Task>[] = [];

  // Generate proposal follow-ups
  const proposalTasks = processedItems.filter(item => item.sales_context.proposal_related);
  if (proposalTasks.length > 0 && config.generateProposalTasks) {
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 3); // Follow up in 3 days

    followUpTasks.push({
      title: `Follow up on proposal sent to ${meetingContext.company_name}`,
      description: `Check status of proposal sent during meeting: ${meetingContext.meeting_id}`,
      due_date: followUpDate.toISOString(),
      priority: 'high',
      task_type: 'follow_up',
      assigned_to: meetingContext.owner_user_id,
      deal_id: meetingContext.deal_id
    });
  }

  // Generate client engagement tracking tasks
  const clientTasks = processedItems.filter(item => item.role_category === 'client');
  if (clientTasks.length > 0 && config.trackClientEngagement) {
    const checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate() + 7); // Check in weekly

    followUpTasks.push({
      title: `Check client progress on action items`,
      description: `Follow up on ${clientTasks.length} client action items from meeting`,
      due_date: checkInDate.toISOString(),
      priority: 'medium',
      task_type: 'follow_up',
      assigned_to: meetingContext.owner_user_id,
      deal_id: meetingContext.deal_id
    });
  }

  return followUpTasks;
}

/**
 * Basic holiday checking function (can be enhanced with external holiday API)
 */
function isHoliday(date: Date): boolean {
  // Basic implementation - can be enhanced with actual holiday data
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Common US holidays (basic implementation)
  const holidays = [
    { month: 1, day: 1 },   // New Year's Day
    { month: 7, day: 4 },   // Independence Day
    { month: 12, day: 25 }, // Christmas Day
  ];
  
  return holidays.some(holiday => holiday.month === month && holiday.day === day);
}

/**
 * Validates configuration and provides recommendations
 */
export function validateConfig(config: ProcessingConfig): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check deadline rules
  if (config.deadlineRules?.enabled) {
    if (config.deadlineRules.urgentDays > config.deadlineRules.highDays) {
      warnings.push('Urgent tasks have longer deadlines than high priority tasks');
    }
    
    if (config.deadlineRules.lowDays < 7) {
      recommendations.push('Consider setting low priority tasks to at least 7 days');
    }
  }

  // Check assignment rules
  if (config.assignmentRules?.enabled && !config.assignmentRules.defaultSalesRep) {
    recommendations.push('Set a default sales rep for fallback assignment');
  }

  // Check role categorization
  if (config.roleCategorization?.enabled) {
    if (config.roleCategorization.salesRepKeywords.length === 0) {
      warnings.push('No sales rep keywords configured for role categorization');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    recommendations
  };
}