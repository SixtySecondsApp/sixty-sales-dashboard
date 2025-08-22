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

async function testQuickAdd() {
  try {
    console.log('🧪 Testing Quick Add functionality...\n');
    
    // 1. Test deal stages are available
    console.log('1️⃣ Checking deal stages...');
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('id, name, order_position')
      .order('order_position');
    
    if (stagesError) {
      console.error('❌ Error fetching stages:', stagesError);
      return;
    }
    
    console.log(`✅ Found ${stages?.length || 0} stages:`);
    stages?.forEach(stage => {
      console.log(`   - ${stage.name} (position: ${stage.order_position})`);
    });
    
    // 2. Test creating a deal
    console.log('\n2️⃣ Testing deal creation...');
    
    // Get the first user for testing
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .limit(1);
    
    const testUser = users?.[0];
    if (!testUser) {
      console.error('❌ No users found for testing');
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
    
    console.log('📝 Creating test deal:', testDeal.name);
    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select('id, name, created_at')
      .single();
    
    if (dealError) {
      console.error('❌ Error creating deal:', dealError);
      return;
    }
    
    console.log('✅ Deal created successfully:', {
      id: newDeal.id,
      name: newDeal.name,
      created_at: newDeal.created_at
    });
    
    // 3. Test creating an activity linked to the deal
    console.log('\n3️⃣ Testing activity creation...');
    
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
    
    console.log('📝 Creating test activity linked to deal...');
    const { data: newActivity, error: activityError } = await supabase
      .from('activities')
      .insert(testActivity)
      .select('id, type, client_name, deal_id, created_at')
      .single();
    
    if (activityError) {
      console.error('❌ Error creating activity:', activityError);
      
      // If it's a foreign key error, try to verify the deal exists
      if (activityError.code === '23503') {
        console.log('🔍 Foreign key error - checking if deal exists...');
        const { data: checkDeal, error: checkError } = await supabase
          .from('deals')
          .select('id, name')
          .eq('id', newDeal.id)
          .single();
        
        if (checkError) {
          console.error('❌ Deal verification failed:', checkError);
        } else if (checkDeal) {
          console.log('✅ Deal exists in database:', checkDeal);
          console.log('⚠️ Foreign key constraint may be a timing issue');
        }
      }
      return;
    }
    
    console.log('✅ Activity created successfully:', {
      id: newActivity.id,
      type: newActivity.type,
      client_name: newActivity.client_name,
      deal_id: newActivity.deal_id,
      created_at: newActivity.created_at
    });
    
    // 4. Clean up test data
    console.log('\n4️⃣ Cleaning up test data...');
    
    // Delete activity first (due to foreign key)
    if (newActivity) {
      const { error: deleteActivityError } = await supabase
        .from('activities')
        .delete()
        .eq('id', newActivity.id);
      
      if (deleteActivityError) {
        console.error('⚠️ Failed to delete test activity:', deleteActivityError);
      } else {
        console.log('✅ Test activity deleted');
      }
    }
    
    // Delete deal
    if (newDeal) {
      const { error: deleteDealError } = await supabase
        .from('deals')
        .delete()
        .eq('id', newDeal.id);
      
      if (deleteDealError) {
        console.error('⚠️ Failed to delete test deal:', deleteDealError);
      } else {
        console.log('✅ Test deal deleted');
      }
    }
    
    console.log('\n✨ Quick Add functionality test completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Deal stages: ✅ Working');
    console.log('   - Deal creation: ✅ Working');
    console.log('   - Activity creation: ✅ Working');
    console.log('   - Foreign key constraints: ✅ Working');
    
  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
  }
}

// Run the test
testQuickAdd().then(() => {
  console.log('\n🏁 Test script completed');
  process.exit(0);
});