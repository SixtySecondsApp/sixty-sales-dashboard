import { createClient } from '@supabase/supabase-js';

// Use environment variables directly since Vite isn't available in Node
const SUPABASE_URL = 'https://uocsgquahrweusxfnagz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY3NncXVhaHJ3ZXVzeGZuYWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTEwMDIxNywiZXhwIjoyMDQ2Njc2MjE3fQ.mbIEBJD48Ii6ecpzmZsQa9Q7d4cxQELX4GrMWekfDGE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function initDealStages() {
  console.log('🚀 Initializing deal stages...');
  
  try {
    // First check if stages exist
    const { data: existingStages, error: checkError } = await supabase
      .from('deal_stages')
      .select('*')
      .order('order_position');
    
    if (checkError) {
      console.error('❌ Error checking existing stages:', checkError);
      return;
    }
    
    console.log(`📊 Found ${existingStages?.length || 0} existing stages:`);
    if (existingStages && existingStages.length > 0) {
      existingStages.forEach(stage => {
        console.log(`   - ${stage.name || '(no name)'} (${stage.id}) - position: ${stage.order_position}`);
      });
      
      // Check if any stages have null names
      const stagesWithoutNames = existingStages.filter(s => !s.name);
      if (stagesWithoutNames.length > 0) {
        console.log('⚠️ Found stages without names. Deleting them...');
        const { error: deleteError } = await supabase
          .from('deal_stages')
          .delete()
          .in('id', stagesWithoutNames.map(s => s.id));
        
        if (deleteError) {
          console.error('❌ Error deleting invalid stages:', deleteError);
        } else {
          console.log('✅ Deleted invalid stages');
        }
      }
      
      // If we have valid stages, we're done
      const validStages = existingStages.filter(s => s.name);
      if (validStages.length > 0) {
        console.log('✅ Valid stages exist');
        return;
      }
    }
    
    // Insert default stages
    console.log('📝 Creating default stages...');
    const defaultStages = [
      { name: 'Lead', description: 'New potential opportunity', color: '#3B82F6', order_position: 10, default_probability: 10 },
      { name: 'SQL', description: 'Sales Qualified Lead', color: '#6366F1', order_position: 20, default_probability: 20 },
      { name: 'Opportunity', description: 'Active opportunity', color: '#8B5CF6', order_position: 30, default_probability: 25 },
      { name: 'Proposal', description: 'Proposal sent', color: '#EAB308', order_position: 40, default_probability: 50 },
      { name: 'Verbal', description: 'Verbal commitment', color: '#F97316', order_position: 45, default_probability: 75 },
      { name: 'Signed', description: 'Deal signed', color: '#10B981', order_position: 50, default_probability: 100 },
      { name: 'Signed & Paid', description: 'Deal signed and payment received', color: '#059669', order_position: 60, default_probability: 100 },
      { name: 'Lost', description: 'Deal lost', color: '#EF4444', order_position: 70, default_probability: 0 }
    ];
    
    const { data: insertedStages, error: insertError } = await supabase
      .from('deal_stages')
      .insert(defaultStages)
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting stages:', insertError);
      return;
    }
    
    console.log('✅ Successfully created stages:');
    insertedStages.forEach(stage => {
      console.log(`   - ${stage.name} (${stage.id})`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
  
  process.exit(0);
}

// Run the initialization
initDealStages();