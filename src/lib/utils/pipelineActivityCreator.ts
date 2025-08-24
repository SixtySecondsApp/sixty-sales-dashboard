import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export type ActivityType = 'meeting' | 'proposal' | 'sale' | null;

interface Deal {
  id: string;
  name?: string;
  company?: string;
  value: number;
  owner_id: string;
  contact_email?: string;
}

interface Stage {
  id: string;
  name: string;
}

/**
 * Determines what type of activity should be created based on stage transition
 */
export function getActivityTypeForStageTransition(
  fromStage: Stage | null,
  toStage: Stage
): ActivityType {
  const toStageName = toStage.name.toLowerCase();
  
  // Skip activity creation for Verbal and Lost stages
  if (toStageName.includes('verbal') || toStageName.includes('lost')) {
    return null;
  }
  
  // Map stage transitions to activity types
  if (toStageName.includes('sql') || toStageName.includes('mql')) {
    return 'meeting';
  }
  
  if (toStageName.includes('opportunity')) {
    return 'proposal';
  }
  
  if (toStageName.includes('signed') && !toStageName.includes('paid')) {
    return 'sale';
  }
  
  return null;
}

/**
 * Creates an activity for a pipeline stage transition
 */
export async function createPipelineActivity(
  deal: Deal,
  toStage: Stage,
  activityType: ActivityType
): Promise<boolean> {
  try {
    logger.log(`📝 Creating ${activityType} activity for deal ${deal.id} (${deal.name || deal.company})`);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.warn('❌ No authenticated user for activity creation');
      return false;
    }
    
    logger.log(`👤 Current user: ${user.id}, Deal owner: ${deal.owner_id}`);
    
    // Only create activity if user is the deal owner (RLS restriction)
    if (deal.owner_id !== user.id) {
      logger.warn(`⚠️ Skipping activity creation - user ${user.id} is not deal owner ${deal.owner_id}`);
      return false;
    }
    
    // Get user profile for sales_rep name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      logger.warn('User profile not found for activity creation');
      return false;
    }
    
    const salesRepName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    
    // Determine activity details based on type
    let details = '';
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let amount = 0;
    
    switch (activityType) {
      case 'meeting':
        details = `Initial meeting for ${deal.name || deal.company || 'deal'}`;
        priority = 'medium';
        break;
      case 'proposal':
        details = `Proposal sent for ${deal.name || deal.company || 'deal'}`;
        priority = 'high';
        amount = deal.value;
        break;
      case 'sale':
        details = `${deal.name || deal.company || 'Sale'} - Closed Won`;
        priority = 'high';
        amount = deal.value;
        break;
    }
    
    // Check if activity already exists for this deal and type
    const { data: existingActivity } = await supabase
      .from('activities')
      .select('id')
      .eq('deal_id', deal.id)
      .eq('type', activityType)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (existingActivity) {
      logger.info(`Activity of type ${activityType} already exists for deal ${deal.id}`);
      return false;
    }
    
    // Create the activity
    const activityData = {
      user_id: user.id,
      type: activityType,
      client_name: deal.company || deal.name || 'Unknown Client',
      details,
      amount,
      priority,
      sales_rep: salesRepName,
      date: new Date().toISOString(),
      status: 'completed' as const,
      quantity: 1,
      deal_id: deal.id,
      contact_identifier: deal.contact_email || null,
      contact_identifier_type: deal.contact_email ? 'email' as const : null,
    };
    
    const { error } = await supabase
      .from('activities')
      .insert(activityData);
    
    if (error) {
      logger.error(`Failed to create ${activityType} activity for deal ${deal.id}:`, error);
      return false;
    }
    
    logger.log(`✅ Created ${activityType} activity for deal ${deal.id} (${deal.name})`);
    return true;
    
  } catch (error) {
    logger.error('Error creating pipeline activity:', error);
    return false;
  }
}

/**
 * Checks if an activity should be created for a stage transition and creates it
 */
export async function handlePipelineStageTransition(
  deal: Deal,
  fromStage: Stage | null,
  toStage: Stage
): Promise<boolean> {
  logger.log(`🎯 Pipeline Activity Check: ${deal.name || deal.company} moving from ${fromStage?.name || 'unknown'} to ${toStage.name}`);
  
  const activityType = getActivityTypeForStageTransition(fromStage, toStage);
  
  if (!activityType) {
    logger.log(`❌ No activity needed for transition to ${toStage.name}`);
    return false;
  }
  
  logger.log(`✅ Activity type determined: ${activityType} for stage ${toStage.name}`);
  return await createPipelineActivity(deal, toStage, activityType);
}