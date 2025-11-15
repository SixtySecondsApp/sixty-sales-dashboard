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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testQuickAdd() {
  try {
    // 1. Test deal stages are available
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('id, name, order_position')
      .order('order_position');
    
    if (stagesError) {
      return;
    }
    stages?.forEach(stage => {
    });
    
    // 2. Test creating a deal
    // Get the first user for testing
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .limit(1);
    
    const testUser = users?.[0];
    if (!testUser) {
      return;
    }
    
    const opportunityStage = stages?.find(s => s.name?.toLowerCase().includes('opportunity')) || stages?.[0];
    
    const testDeal = {
      name: 'Test Deal from Quick Add',
      company: 'Test Company ABC',
      value: 5000,
      stage_id: opportunityStage?.id,
      owner_id: testUser.id,
      probability: opportunityStage?.default_probability || 25,
      status: 'active',
      description: 'Test deal created via Quick Add script',
      expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };
    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select('id, name, created_at')
      .single();
    
    if (dealError) {
      return;
    }
    // 3. Test creating an activity linked to the deal
    const testActivity = {
      user_id: testUser.id,
      type: 'proposal',
      client_name: 'Test Company ABC',
      details: 'Proposal sent for Test Deal',
      amount: 5000,
      priority: 'high',
      sales_rep: `${testUser.first_name} ${testUser.last_name}`,
      date: new Date().toISOString(),
      status: 'completed',
      deal_id: newDeal.id
    };
    const { data: newActivity, error: activityError } = await supabase
      .from('activities')
      .insert(testActivity)
      .select('id, type, client_name, deal_id, created_at')
      .single();
    
    if (activityError) {
      // If it's a foreign key error, try to verify the deal exists
      if (activityError.code === '23503') {
        const { data: checkDeal, error: checkError } = await supabase
          .from('deals')
          .select('id, name')
          .eq('id', newDeal.id)
          .single();
        
        if (checkError) {
        } else if (checkDeal) {
        }
      }
      return;
    }
    // 4. Clean up test data
    // Delete activity first (due to foreign key)
    if (newActivity) {
      const { error: deleteActivityError } = await supabase
        .from('activities')
        .delete()
        .eq('id', newActivity.id);
      
      if (deleteActivityError) {
      } else {
      }
    }
    
    // Delete deal
    if (newDeal) {
      const { error: deleteDealError } = await supabase
        .from('deals')
        .delete()
        .eq('id', newDeal.id);
      
      if (deleteDealError) {
      } else {
      }
    }
  } catch (error) {
  }
}

// Run the test
testQuickAdd().then(() => {
  process.exit(0);
});