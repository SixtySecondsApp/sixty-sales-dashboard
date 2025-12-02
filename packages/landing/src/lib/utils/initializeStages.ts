import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export async function initializeDefaultStages() {
  try {
    logger.log('🔍 Checking existing stages...');
    
    // Check if stages exist
    const { data: existingStages, error: checkError } = await (supabase as any)
      .from('deal_stages')
      .select('*')
      .order('order_position');
    
    if (checkError) {
      logger.error('❌ Error checking stages:', checkError);
      return false;
    }
    
    logger.log(`📊 Found ${existingStages?.length || 0} stages`);
    
    // If we have stages with names, we're good
    const validStages = existingStages?.filter((s: any) => s.name);
    if (validStages && validStages.length > 0) {
      logger.log('✅ Valid stages already exist');
      return true;
    }
    
    // Delete any stages without names
    if (existingStages && existingStages.length > 0) {
      logger.log('⚠️ Deleting invalid stages without names...');
      const invalidIds = existingStages
        .filter((s: any) => !s.name)
        .map((s: any) => s.id);
      
      if (invalidIds.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('deal_stages')
          .delete()
          .in('id', invalidIds);
        
        if (deleteError) {
          logger.error('❌ Error deleting invalid stages:', deleteError);
        }
      }
    }
    
    // Create default stages
    logger.log('📝 Creating default stages...');
    const defaultStages = [
      { name: 'Lead', description: 'New potential opportunity', color: '#3B82F6', order_position: 10, default_probability: 10 },
      { name: 'SQL', description: 'Sales Qualified Lead', color: '#6366F1', order_position: 20, default_probability: 20 },
      { name: 'Opportunity', description: 'Active opportunity', color: '#8B5CF6', order_position: 30, default_probability: 25 },
      { name: 'Proposal', description: 'Proposal sent', color: '#EAB308', order_position: 40, default_probability: 50 },
      { name: 'Verbal', description: 'Verbal commitment', color: '#F97316', order_position: 45, default_probability: 75 },
      { name: 'Signed', description: 'Deal signed', color: '#10B981', order_position: 50, default_probability: 100 },
      { name: 'Lost', description: 'Deal lost', color: '#EF4444', order_position: 60, default_probability: 0 }
    ];
    
    const { data: newStages, error: insertError } = await (supabase as any)
      .from('deal_stages')
      .insert(defaultStages)
      .select();
    
    if (insertError) {
      logger.error('❌ Error creating stages:', insertError);
      return false;
    }
    
    logger.log('✅ Successfully created default stages:', newStages);
    return true;
    
  } catch (error) {
    logger.error('❌ Unexpected error initializing stages:', error);
    return false;
  }
}