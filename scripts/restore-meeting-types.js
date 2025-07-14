import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function analyzeMeetingData() {
  console.log('🔍 Analyzing current meeting data...\n');

  // First, let's see what we currently have
  const { data: currentMeetings, error: fetchError } = await supabase
    .from('activities')
    .select('id, details, created_at, updated_at')
    .eq('type', 'meeting')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching meetings:', fetchError.message);
    process.exit(1);
  }

  // Count occurrences of each meeting type
  const meetingTypeCounts = {};
  currentMeetings.forEach(meeting => {
    const type = meeting.details || 'Unknown';
    meetingTypeCounts[type] = (meetingTypeCounts[type] || 0) + 1;
  });

  console.log('📊 Current Meeting Type Distribution:');
  Object.entries(meetingTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} meetings`);
    });

  // Check if we have any "Product Demo" entries that need to be changed to "Demo"
  const { data: productDemos, error: demoError } = await supabase
    .from('activities')
    .select('id, details')
    .eq('type', 'meeting')
    .eq('details', 'Product Demo');

  if (!demoError && productDemos && productDemos.length > 0) {
    console.log(`\n⚠️  Found ${productDemos.length} "Product Demo" entries that should be changed to "Demo"`);
    
    const confirmChange = process.argv[2] === '--fix-demos';
    if (confirmChange) {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ details: 'Demo' })
        .eq('details', 'Product Demo');

      if (updateError) {
        console.error('Error updating Product Demo to Demo:', updateError.message);
      } else {
        console.log('✅ Updated all "Product Demo" entries to "Demo"');
      }
    } else {
      console.log('   Run with --fix-demos flag to update these to "Demo"');
    }
  }

  // Analysis for potential restoration
  console.log('\n📝 Data Restoration Analysis:');
  console.log('Unfortunately, the original script changed all discovery-related entries to "Discovery Call".');
  console.log('Without backup data or audit logs, we cannot determine what the original values were.');
  console.log('\nPossible original values that were changed:');
  console.log('   - "Discovery" → "Discovery Call"');
  console.log('   - "discovery" → "Discovery Call"');
  console.log('   - "Discovery Meeting" → "Discovery Call"');
  console.log('   - Any variation with "discovery" in it → "Discovery Call"');
  
  console.log('\n💡 Recommendations:');
  console.log('1. If you have database backups from before the script ran, restore from those');
  console.log('2. If you have audit logs or activity history, use those to identify original values');
  console.log('3. Manual review: Go through recent "Discovery Call" entries and update based on context');
  console.log('4. Going forward, the system now supports these meeting types:');
  console.log('   - Discovery Call');
  console.log('   - Discovery Meeting');
  console.log('   - Demo');
  console.log('   - Follow-up');
  console.log('   - Proposal');
  console.log('   - Client Call');
  console.log('   - Other');
}

analyzeMeetingData()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });