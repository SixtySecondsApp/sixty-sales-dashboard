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

async function testCompleteFlow() {
  try {
    // 1. Get test data
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .limit(1);
    
    const { data: stages } = await supabase
      .from('deal_stages')
      .select('id, name, default_probability')
      .order('order_position');
    
    if (!users?.[0] || !stages?.length) {
      return;
    }
    
    const testUser = users[0];
    const opportunityStage = stages.find(s => s.name?.toLowerCase().includes('opportunity')) || stages[0];
    // 2. Create a deal (simulating Quick Add -> Create Deal)
    const dealData = {
      name: 'Quick Add Test Deal',
      company: 'Quick Add Test Company',
      contact_name: 'John Doe',
      contact_email: 'john@quickadd-test.com',
      contact_phone: '+1234567890',
      value: 10000,
      description: 'Deal created via Quick Add test script',
      stage_id: opportunityStage.id,
      owner_id: testUser.id,
      expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      probability: opportunityStage.default_probability,
      status: 'active'
    };
    
    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert(dealData)
      .select('id, name, stage_id, value')
      .single();
    
    if (dealError) {
      return;
    }
    // 3. Wait a bit to ensure deal is committed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Create activities linked to the deal
    // Create outbound activity
    const outboundActivity = {
      user_id: testUser.id,
      type: 'outbound',
      client_name: 'Quick Add Test Company',
      details: 'Call',
      quantity: 1,
      priority: 'medium',
      sales_rep: `${testUser.first_name} ${testUser.last_name}`,
      date: new Date().toISOString(),
      status: 'completed',
      deal_id: newDeal.id
    };
    
    const { data: outbound, error: outboundError } = await supabase
      .from('activities')
      .insert(outboundActivity)
      .select('id, type')
      .single();
    
    if (outboundError) {
    } else {
    }
    
    // Create meeting activity
    const meetingActivity = {
      user_id: testUser.id,
      type: 'meeting',
      client_name: 'Quick Add Test Company',
      details: 'Discovery Call',
      priority: 'high',
      sales_rep: `${testUser.first_name} ${testUser.last_name}`,
      date: new Date().toISOString(),
      status: 'completed',
      deal_id: newDeal.id
    };
    
    const { data: meeting, error: meetingError } = await supabase
      .from('activities')
      .insert(meetingActivity)
      .select('id, type')
      .single();
    
    if (meetingError) {
    } else {
    }
    
    // Create proposal activity
    const proposalActivity = {
      user_id: testUser.id,
      type: 'proposal',
      client_name: 'Quick Add Test Company',
      details: 'Proposal sent for Quick Add Test Deal',
      amount: 10000,
      priority: 'high',
      sales_rep: `${testUser.first_name} ${testUser.last_name}`,
      date: new Date().toISOString(),
      status: 'completed',
      deal_id: newDeal.id
    };
    
    const { data: proposal, error: proposalError } = await supabase
      .from('activities')
      .insert(proposalActivity)
      .select('id, type, amount')
      .single();
    
    if (proposalError) {
    } else {
    }
    
    // Create sale activity
    const saleActivity = {
      user_id: testUser.id,
      type: 'sale',
      client_name: 'Quick Add Test Company',
      details: 'one-off Sale',
      amount: 10000,
      priority: 'high',
      sales_rep: `${testUser.first_name} ${testUser.last_name}`,
      date: new Date().toISOString(),
      status: 'completed',
      deal_id: newDeal.id
    };
    
    const { data: sale, error: saleError } = await supabase
      .from('activities')
      .insert(saleActivity)
      .select('id, type, amount')
      .single();
    
    if (saleError) {
    } else {
    }
    
    // 5. Verify all activities are linked to the deal
    const { data: linkedActivities, error: verifyError } = await supabase
      .from('activities')
      .select('id, type, deal_id')
      .eq('deal_id', newDeal.id);
    
    if (verifyError) {
    } else {
      linkedActivities.forEach(activity => {
      });
    }
    
    // 6. Clean up test data
    // Delete activities first (foreign key constraint)
    const { error: deleteActivitiesError } = await supabase
      .from('activities')
      .delete()
      .eq('deal_id', newDeal.id);
    
    if (deleteActivitiesError) {
    } else {
    }
    
    // Delete deal
    const { error: deleteDealError } = await supabase
      .from('deals')
      .delete()
      .eq('id', newDeal.id);
    
    if (deleteDealError) {
    } else {
    }
    
    // Summary
  } catch (error) {
  }
}

// Run the test
testCompleteFlow().then(() => {
  process.exit(0);
});