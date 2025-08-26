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

async function testQuickAddComplete() {
  console.log('🔍 Testing QuickAdd Deal & Activity Creation for All Types\n');
  console.log('Expected behavior for all three types:');
  console.log('✅ Meetings → Creates deal in SQL stage + meeting activity');
  console.log('✅ Proposals → Creates deal in Opportunity stage + proposal activity');
  console.log('✅ Sales → Creates deal in Signed stage + sale activity\n');
  console.log('═'.repeat(60) + '\n');
  
  // Check recent activities and their linked deals
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  // Test each activity type
  const activityTypes = ['meeting', 'proposal', 'sale'];
  
  for (const type of activityTypes) {
    console.log(`📌 Testing ${type.toUpperCase()} activities:`);
    console.log('-'.repeat(40));
    
    const { data: activities, error } = await supabase
      .from('activities')
      .select(`
        *,
        deals (
          id,
          name,
          company,
          stage_id,
          created_at,
          value,
          deal_stages (
            name
          )
        )
      `)
      .eq('type', type)
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (error) {
      console.error(`Error fetching ${type} activities:`, error);
      continue;
    }
    
    if (activities.length === 0) {
      console.log(`   ❌ No recent ${type} activities found\n`);
    } else {
      activities.forEach(activity => {
        console.log(`   📅 ${activity.client_name} - ${activity.details || type}`);
        console.log(`      Created: ${new Date(activity.created_at).toLocaleString()}`);
        
        if (activity.deal_id && activity.deals) {
          console.log(`      ✅ Deal: ${activity.deals.name}`);
          console.log(`         Stage: ${activity.deals.deal_stages?.name || 'Unknown'}`);
          console.log(`         Value: $${activity.deals.value || 0}`);
          
          // Check if deal was created around the same time (within 10 seconds)
          const activityTime = new Date(activity.created_at);
          const dealTime = new Date(activity.deals.created_at);
          const timeDiff = Math.abs(activityTime - dealTime) / 1000;
          
          if (timeDiff < 10) {
            console.log(`         🎯 Auto-created with activity (${timeDiff.toFixed(1)}s difference)`);
          }
        } else {
          console.log(`      ❌ No deal linked`);
        }
        console.log('');
      });
    }
  }
  
  // Summary of stages for auto-created deals
  console.log('═'.repeat(60));
  console.log('\n📊 Stage Assignment Summary:');
  console.log('   Meeting activities  → SQL stage');
  console.log('   Proposal activities → Opportunity stage');
  console.log('   Sale activities     → Signed stage');
  
  console.log('\n✅ Test Instructions:');
  console.log('1. Open QuickAdd and test each type WITHOUT selecting a deal:');
  console.log('   a. Add Meeting → Should create deal in SQL + meeting activity');
  console.log('   b. Add Proposal → Should create deal in Opportunity + proposal activity');
  console.log('   c. Add Sale → Should create deal in Signed + sale activity');
  console.log('2. Check the Pipeline view to see all three new deals');
  console.log('3. Check the Activities dashboard to see all three activities');
}

testQuickAddComplete();