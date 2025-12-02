import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

/**
 * Remove the "Signed & Paid" stage since it's no longer used
 */
export async function removeSignedAndPaidStage() {
  try {
    logger.log('🗑️ Removing "Signed & Paid" stage...');
    
    // Find the "Signed & Paid" stage
    const { data: signedPaidStage, error: findError } = await (supabase as any)
      .from('deal_stages')
      .select('id, name')
      .eq('name', 'Signed & Paid')
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      logger.error('❌ Error finding Signed & Paid stage:', findError);
      return false;
    }
    
    if (!signedPaidStage) {
      logger.log('✅ "Signed & Paid" stage not found - already removed');
      return true;
    }
    
    logger.log('📍 Found "Signed & Paid" stage:', signedPaidStage);
    
    // First, check if there are any deals using this stage
    const { data: dealsUsingStage, error: dealsError } = await (supabase as any)
      .from('deals')
      .select('id, name')
      .eq('stage_id', signedPaidStage.id);
    
    if (dealsError) {
      logger.error('❌ Error checking deals using stage:', dealsError);
      return false;
    }
    
    if (dealsUsingStage && dealsUsingStage.length > 0) {
      logger.log(`⚠️ Found ${dealsUsingStage.length} deals using "Signed & Paid" stage`);
      
      // Find the "Signed" stage to migrate deals to
      const { data: signedStage, error: signedError } = await (supabase as any)
        .from('deal_stages')
        .select('id, name')
        .eq('name', 'Signed')
        .single();
      
      if (signedError || !signedStage) {
        logger.error('❌ Cannot find "Signed" stage to migrate deals to:', signedError);
        return false;
      }
      
      logger.log('🔄 Migrating deals from "Signed & Paid" to "Signed"...');
      
      // Update all deals using "Signed & Paid" to use "Signed" instead
      const { error: updateError } = await (supabase as any)
        .from('deals')
        .update({ stage_id: signedStage.id })
        .eq('stage_id', signedPaidStage.id);
      
      if (updateError) {
        logger.error('❌ Error migrating deals:', updateError);
        return false;
      }
      
      logger.log(`✅ Successfully migrated ${dealsUsingStage.length} deals to "Signed" stage`);
    }
    
    // Now delete the "Signed & Paid" stage
    const { error: deleteError } = await (supabase as any)
      .from('deal_stages')
      .delete()
      .eq('id', signedPaidStage.id);
    
    if (deleteError) {
      logger.error('❌ Error deleting "Signed & Paid" stage:', deleteError);
      return false;
    }
    
    logger.log('✅ Successfully removed "Signed & Paid" stage');
    return true;
    
  } catch (error) {
    logger.error('❌ Unexpected error removing "Signed & Paid" stage:', error);
    return false;
  }
}