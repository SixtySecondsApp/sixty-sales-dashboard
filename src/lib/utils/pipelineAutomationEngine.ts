import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { toast } from 'sonner';

export interface PipelineAutomationRule {
  id: string;
  rule_name: string;
  rule_description?: string;
  from_stage_id?: string;
  to_stage_id: string;
  action_type: 'create_activity' | 'create_task' | 'send_notification' | 'update_field';
  
  // Activity parameters
  activity_type?: string;
  activity_title?: string;
  activity_details?: string;
  activity_amount_source?: 'deal_value' | 'fixed_amount' | 'none';
  activity_fixed_amount?: number;
  
  // Task parameters
  task_title?: string;
  task_description?: string;
  task_type?: string;
  task_priority?: string;
  task_days_after?: number;
  
  // Metadata
  is_active: boolean;
  execution_order: number;
}

export interface Deal {
  id: string;
  name?: string;
  company?: string;
  value: number;
  owner_id: string;
  contact_email?: string;
  stage_id: string;
}

export interface Stage {
  id: string;
  name: string;
  order_position: number;
}

/**
 * Executes pipeline automation rules when a deal moves between stages
 * This is the client-side fallback if the database trigger doesn't work
 */
export async function executePipelineAutomationRules(
  deal: Deal,
  fromStage: Stage | null,
  toStage: Stage,
  showUserFeedback: boolean = false
): Promise<boolean> {
  try {
    logger.log(`🎯 Pipeline Automation: ${deal.name || deal.company} moving from ${fromStage?.name || 'unknown'} to ${toStage.name}`);
    
    // Find matching automation rules
    const { data: rules, error: rulesError } = await supabase
      .from('pipeline_automation_rules')
      .select('*')
      .eq('to_stage_id', toStage.id)
      .eq('is_active', true)
      .or(fromStage ? `from_stage_id.eq.${fromStage.id},from_stage_id.is.null` : 'from_stage_id.is.null')
      .order('execution_order', { ascending: true });
    
    if (rulesError) {
      logger.error('❌ Error fetching automation rules:', rulesError);
      return false;
    }
    
    if (!rules || rules.length === 0) {
      logger.log('❌ No automation rules found for this transition');
      return true; // Not an error, just no rules
    }
    
    logger.log(`✅ Found ${rules.length} automation rules to execute`);
    
    // Execute each rule
    let successCount = 0;
    let failureCount = 0;
    
    for (const rule of rules) {
      try {
        const success = await executeAutomationRule(rule, deal, fromStage, toStage);
        if (success) {
          successCount++;
          logger.log(`✅ Rule "${rule.rule_name}" executed successfully`);
        } else {
          failureCount++;
          logger.warn(`⚠️ Rule "${rule.rule_name}" execution failed`);
        }
      } catch (error) {
        failureCount++;
        logger.error(`❌ Error executing rule "${rule.rule_name}":`, error);
        
        // Log execution failure
        await logRuleExecution(rule.id, deal.id, fromStage?.id, toStage.id, 'failed', error);
      }
    }
    
    // Show user feedback if requested
    if (showUserFeedback && (successCount > 0 || failureCount > 0)) {
      if (failureCount === 0) {
        toast.success(`🎯 ${successCount} automation rule${successCount > 1 ? 's' : ''} executed`);
      } else if (successCount === 0) {
        toast.error(`❌ ${failureCount} automation rule${failureCount > 1 ? 's' : ''} failed`);
      } else {
        toast.info(`🎯 ${successCount} automation rules executed, ${failureCount} failed`);
      }
    }
    
    return failureCount === 0;
    
  } catch (error) {
    logger.error('❌ Pipeline automation engine error:', error);
    if (showUserFeedback) {
      toast.error('Pipeline automation encountered an error');
    }
    return false;
  }
}

/**
 * Executes a single automation rule
 */
async function executeAutomationRule(
  rule: PipelineAutomationRule,
  deal: Deal,
  fromStage: Stage | null,
  toStage: Stage
): Promise<boolean> {
  try {
    switch (rule.action_type) {
      case 'create_activity':
        return await createActivity(rule, deal);
        
      case 'create_task':
        return await createTask(rule, deal);
        
      case 'send_notification':
        return await sendNotification(rule, deal, fromStage, toStage);
        
      case 'update_field':
        // Field updates would require more complex implementation
        logger.warn('Field updates not yet implemented');
        return true;
        
      default:
        logger.warn(`Unknown action type: ${rule.action_type}`);
        return false;
    }
  } catch (error) {
    logger.error(`Error in rule execution for ${rule.action_type}:`, error);
    return false;
  }
}

/**
 * Creates an activity based on automation rule
 */
async function createActivity(rule: PipelineAutomationRule, deal: Deal): Promise<boolean> {
  try {
    // Calculate activity amount
    let activityAmount = 0;
    if (rule.activity_amount_source === 'deal_value') {
      activityAmount = deal.value || 0;
    } else if (rule.activity_amount_source === 'fixed_amount' && rule.activity_fixed_amount) {
      activityAmount = rule.activity_fixed_amount;
    }
    
    // Get user profile for sales rep name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', deal.owner_id)
      .single();
    
    const salesRepName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';
    
    // Check if activity already exists to prevent duplicates
    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('deal_id', deal.id)
      .eq('type', rule.activity_type)
      .eq('user_id', deal.owner_id)
      .maybeSingle();
    
    if (existingActivity) {
      logger.info(`Activity of type ${rule.activity_type} already exists for deal ${deal.id}`);
      return true; // Not an error, just already exists
    }
    
    // Create the activity
    const activityData = {
      user_id: deal.owner_id,
      type: rule.activity_type,
      client_name: deal.company || deal.name || 'Unknown Client',
      details: rule.activity_details || rule.activity_title || `${rule.activity_type} activity`,
      amount: activityAmount,
      priority: 'medium' as const,
      sales_rep: salesRepName,
      date: new Date().toISOString(),
      status: 'completed' as const,
      quantity: 1,
      deal_id: deal.id,
      contact_identifier: deal.contact_email || null,
      contact_identifier_type: deal.contact_email ? 'email' as const : null,
    };
    
    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select('id')
      .single();
    
    if (error) {
      logger.error(`Failed to create activity for rule ${rule.rule_name}:`, error);
      return false;
    }
    
    // Log successful execution
    await logRuleExecution(rule.id, deal.id, null, null, 'success', {
      activity_id: data.id,
      amount: activityAmount,
      activity_type: rule.activity_type
    });
    
    logger.log(`✅ Created ${rule.activity_type} activity for deal ${deal.id} (${deal.name})`);
    return true;
    
  } catch (error) {
    logger.error('Error creating activity:', error);
    return false;
  }
}

/**
 * Creates a task based on automation rule
 */
async function createTask(rule: PipelineAutomationRule, deal: Deal): Promise<boolean> {
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (rule.task_days_after || 0));
    
    const taskData = {
      title: rule.task_title || 'Automated task',
      description: rule.task_description || rule.task_title || 'Task created by automation rule',
      type: rule.task_type || 'follow_up',
      priority: rule.task_priority || 'medium',
      status: 'pending' as const,
      due_date: dueDate.toISOString(),
      deal_id: deal.id,
      assigned_to: deal.owner_id,
      created_by: deal.owner_id,
    };
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('id')
      .single();
    
    if (error) {
      logger.error(`Failed to create task for rule ${rule.rule_name}:`, error);
      return false;
    }
    
    // Log successful execution
    await logRuleExecution(rule.id, deal.id, null, null, 'success', {
      task_id: data.id,
      due_date: dueDate.toISOString(),
      task_type: rule.task_type
    });
    
    logger.log(`✅ Created task for deal ${deal.id} (${deal.name}), due: ${dueDate.toDateString()}`);
    return true;
    
  } catch (error) {
    logger.error('Error creating task:', error);
    return false;
  }
}

/**
 * Sends a notification based on automation rule
 */
async function sendNotification(
  rule: PipelineAutomationRule, 
  deal: Deal, 
  fromStage: Stage | null, 
  toStage: Stage
): Promise<boolean> {
  try {
    // For now, just show a toast notification
    // This could be extended to send emails, Slack messages, etc.
    const message = rule.rule_description || `Deal ${deal.name || deal.company} moved to ${toStage.name}`;
    
    switch (rule.task_priority) { // Reusing task_priority field for notification type
      case 'urgent':
        toast.error(message);
        break;
      case 'high':
        toast.warning(message);
        break;
      case 'low':
        toast.info(message);
        break;
      default:
        toast.success(message);
    }
    
    // Log successful execution
    await logRuleExecution(rule.id, deal.id, fromStage?.id, toStage.id, 'success', {
      notification_type: rule.task_priority || 'medium',
      message: message
    });
    
    return true;
    
  } catch (error) {
    logger.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Logs rule execution for audit purposes
 */
async function logRuleExecution(
  ruleId: string,
  dealId: string,
  fromStageId?: string,
  toStageId?: string,
  status: 'success' | 'failed' | 'skipped' = 'success',
  details?: any
): Promise<void> {
  try {
    await supabase
      .from('pipeline_automation_executions')
      .insert({
        rule_id: ruleId,
        deal_id: dealId,
        from_stage_id: fromStageId,
        to_stage_id: toStageId,
        execution_status: status,
        execution_details: details,
        executed_by: (await supabase.auth.getUser()).data.user?.id,
      });
  } catch (error) {
    logger.error('Error logging rule execution:', error);
    // Don't throw error - logging failure shouldn't break the automation
  }
}