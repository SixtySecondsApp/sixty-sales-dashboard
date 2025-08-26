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

async function testMeetingCreation() {
  console.log('🔍 Testing Meeting Creation in QuickAdd\n');
  console.log('When a meeting is created via QuickAdd:');
  console.log('1. If no deal is selected, a new deal should be auto-created in SQL stage');
  console.log('2. A meeting activity should be created linked to that deal\n');
  
  // Check recent meetings and their linked deals
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  const { data: recentMeetings, error } = await supabase
    .from('activities')
    .select(`
      *,
      deals (
        id,
        name,
        company,
        stage_id,
        created_at,
        deal_stages (
          name
        )
      )
    `)
    .eq('type', 'meeting')
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching meetings:', error);
    return;
  }
  
  console.log(`Found ${recentMeetings.length} meetings created in the last hour:\n`);
  
  recentMeetings.forEach(meeting => {
    console.log(`📅 Meeting: ${meeting.client_name} - ${meeting.details}`);
    console.log(`   Created: ${new Date(meeting.created_at).toLocaleString()}`);
    
    if (meeting.deal_id && meeting.deals) {
      console.log(`   ✅ Linked to Deal: ${meeting.deals.name}`);
      console.log(`      - Stage: ${meeting.deals.deal_stages?.name || 'Unknown'}`);
      console.log(`      - Deal Created: ${new Date(meeting.deals.created_at).toLocaleString()}`);
      
      // Check if deal was created around the same time as the meeting (within 5 seconds)
      const meetingTime = new Date(meeting.created_at);
      const dealTime = new Date(meeting.deals.created_at);
      const timeDiff = Math.abs(meetingTime - dealTime) / 1000;
      
      if (timeDiff < 5) {
        console.log(`      - 🎯 Deal was auto-created with this meeting (${timeDiff.toFixed(1)}s difference)`);
      }
    } else {
      console.log(`   ❌ No deal linked to this meeting`);
    }
    console.log('');
  });
  
  // Check for orphaned deals (deals without activities)
  const { data: recentDeals } = await supabase
    .from('deals')
    .select(`
      *,
      deal_stages (name)
    `)
    .eq('stage_id', '603b5020-aafc-4646-9195-9f041a9a3f14') // SQL stage
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentDeals && recentDeals.length > 0) {
    console.log('\n📊 Recent SQL Stage Deals (potential auto-created):');
    for (const deal of recentDeals) {
      // Check if this deal has activities
      const { data: activities } = await supabase
        .from('activities')
        .select('type, created_at')
        .eq('deal_id', deal.id);
      
      console.log(`   - ${deal.name}`);
      if (activities && activities.length > 0) {
        console.log(`     Activities: ${activities.map(a => a.type).join(', ')}`);
      } else {
        console.log(`     ⚠️  No activities linked`);
      }
    }
  }
  
  console.log('\n✅ Test complete! Now try:');
  console.log('1. Open QuickAdd in the app');
  console.log('2. Select "Add Meeting"');
  console.log('3. Fill in the prospect name and meeting details');
  console.log('4. DO NOT select a deal (leave it empty)');
  console.log('5. Submit the form');
  console.log('6. Check that both a deal AND a meeting activity were created');
}

testMeetingCreation();