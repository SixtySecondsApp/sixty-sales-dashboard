import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    envVars[key.trim()] = values.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const serviceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixStages() {
  try {
    console.log('🔍 Checking current stages...');
    
    // Get all stages
    const { data: stages, error: fetchError } = await supabase
      .from('deal_stages')
      .select('*')
      .order('order_position');
    
    if (fetchError) {
      console.error('❌ Error fetching stages:', fetchError);
      return;
    }
    
    console.log(`📊 Found ${stages?.length || 0} stages`);
    
    if (stages && stages.length > 0) {
      // Check for stages without names
      const stagesWithoutNames = stages.filter(s => !s.name);
      
      if (stagesWithoutNames.length > 0) {
        console.log(`⚠️ Found ${stagesWithoutNames.length} stages without names`);
        console.log('Stages without names:', stagesWithoutNames);
        
        // Delete stages without names
        const invalidIds = stagesWithoutNames.map(s => s.id);
        const { error: deleteError } = await supabase
          .from('deal_stages')
          .delete()
          .in('id', invalidIds);
        
        if (deleteError) {
          console.error('❌ Error deleting invalid stages:', deleteError);
        } else {
          console.log('✅ Deleted invalid stages');
        }
      } else {
        console.log('✅ All stages have names');
        stages.forEach(stage => {
          console.log(`   📋 ${stage.name} (id: ${stage.id}, order: ${stage.order_position})`);
        });
        return; // Exit if all stages are valid
      }
    }
    
    // If we get here, we need to create default stages
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
    
    const { data: newStages, error: insertError } = await supabase
      .from('deal_stages')
      .insert(defaultStages)
      .select();
    
    if (insertError) {
      console.error('❌ Error creating stages:', insertError);
      return;
    }
    
    console.log('✅ Successfully created default stages:');
    newStages.forEach(stage => {
      console.log(`   📋 ${stage.name} (id: ${stage.id})`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixStages().then(() => {
  console.log('🏁 Script completed');
  process.exit(0);
});