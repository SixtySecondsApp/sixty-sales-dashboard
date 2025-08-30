import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dcqjcbagvnsjhmmvuhyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcWpjYmFndm5zamhtbXZ1aHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcyNzE4MDIsImV4cCI6MjA0Mjg0NzgwMn0.s18zlFdGzwWHPkr9e0s6BPT9DbB4lxCZJKoGAUpqHF4'
);

async function checkViewpointData() {
  console.log('🔍 Checking Viewpoint activities...');
  
  // Get all sale activities for Viewpoint
  const { data: activities, error: activitiesError } = await supabase
    .from('activities')
    .select('*')
    .eq('type', 'sale')
    .eq('status', 'completed')
    .ilike('client_name', '%viewpoint%');
    
  if (activitiesError) {
    console.error('❌ Activities error:', activitiesError);
    return;
  }
  
  console.log('📋 Viewpoint Activities:', activities?.length || 0);
  activities?.forEach(activity => {
    console.log(`  - Activity ${activity.id}: "${activity.client_name}" -> Deal ID: ${activity.deal_id}`);
  });
  
  // Get all deals that might be related
  console.log('\n🔍 Checking all deals...');
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('*')
    .or('company.ilike.%viewpoint%,name.ilike.%viewpoint%');
    
  if (dealsError) {
    console.error('❌ Deals error:', dealsError);
    return;
  }
  
  console.log('🎯 Viewpoint-related Deals:', deals?.length || 0);
  deals?.forEach(deal => {
    console.log(`  - Deal ${deal.id}: "${deal.name}" (${deal.company}) - MRR: ${deal.monthly_mrr}, One-off: ${deal.one_off_revenue}`);
  });
  
  // Check for the specific deal ID we saw
  const specificDealId = 'aa5e10';
  console.log(`\n🔍 Checking specific deal ID: ${specificDealId}...`);
  const { data: specificDeal, error: specificError } = await supabase
    .from('deals')
    .select('*')
    .ilike('id', `%${specificDealId}%`);
    
  if (!specificError && specificDeal) {
    console.log('🎯 Specific deal details:', specificDeal);
  }
}

checkViewpointData().catch(console.error);