import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPipelineActivities() {
  console.log('🔍 Testing Pipeline Activity Creation\n');
  
  // 1. Get current stages
  const { data: stages, error: stagesError } = await supabase
    .from('deal_stages')
    .select('*')
    .order('order_position');
  
  if (stagesError) {
    console.error('Error fetching stages:', stagesError);
    return;
  }
  
  console.log('Current Pipeline Stages:');
  stages.forEach(stage => {
    console.log(`  ${stage.order_position}. ${stage.name} (${stage.id})`);
  });
  
  // 2. Check for recent activities created from pipeline movements
  const { data: recentActivities, error: activitiesError } = await supabase
    .from('activities')
    .select('*')
    .not('deal_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (activitiesError) {
    console.error('Error fetching activities:', activitiesError);
    return;
  }
  
  console.log('\nRecent Deal-Related Activities:');
  if (recentActivities.length === 0) {
    console.log('  No recent deal-related activities found');
  } else {
    recentActivities.forEach(activity => {
      console.log(`  - ${activity.type}: ${activity.client_name} - ${activity.details}`);
      console.log(`    Deal ID: ${activity.deal_id}, Amount: $${activity.amount || 0}`);
      console.log(`    Created: ${new Date(activity.created_at).toLocaleString()}\n`);
    });
  }
  
  // 3. Check for deals and their current stages
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, name, company, stage_id, value, owner_id')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (dealsError) {
    console.error('Error fetching deals:', dealsError);
    return;
  }
  
  console.log('\nRecent Deals:');
  deals.forEach(deal => {
    const stage = stages.find(s => s.id === deal.stage_id);
    console.log(`  - ${deal.name || deal.company} (${deal.id})`);
    console.log(`    Stage: ${stage?.name || 'Unknown'}, Value: $${deal.value}`);
  });
  
  console.log('\n✅ Test complete! Now try:');
  console.log('1. Go to the Pipeline view in the app');
  console.log('2. Drag a deal to the SQL stage → should create a "meeting" activity');
  console.log('3. Drag a deal to Opportunity → should create a "proposal" activity');
  console.log('4. Drag a deal to Signed → should create a "sale" activity');
  console.log('5. Check the Activities page to see the new activities');
}

testPipelineActivities();