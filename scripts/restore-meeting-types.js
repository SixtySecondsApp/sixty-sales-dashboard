import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function analyzeMeetingData() {
  // First, let's see what we currently have
  const { data: currentMeetings, error: fetchError } = await supabase
    .from('activities')
    .select('id, details, created_at, updated_at')
    .eq('type', 'meeting')
    .order('created_at', { ascending: false });

  if (fetchError) {
    process.exit(1);
  }

  // Count occurrences of each meeting type
  const meetingTypeCounts = {};
  currentMeetings.forEach(meeting => {
    const type = meeting.details || 'Unknown';
    meetingTypeCounts[type] = (meetingTypeCounts[type] || 0) + 1;
  });
  Object.entries(meetingTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
    });

  // Check if we have any "Product Demo" entries that need to be changed to "Demo"
  const { data: productDemos, error: demoError } = await supabase
    .from('activities')
    .select('id, details')
    .eq('type', 'meeting')
    .eq('details', 'Product Demo');

  if (!demoError && productDemos && productDemos.length > 0) {
    const confirmChange = process.argv[2] === '--fix-demos';
    if (confirmChange) {
      const { error: updateError } = await supabase
        .from('activities')
        .update({ details: 'Demo' })
        .eq('details', 'Product Demo');

      if (updateError) {
      } else {
      }
    } else {
    }
  }

  // Analysis for potential restoration
}

analyzeMeetingData()
  .then(() => process.exit(0))
  .catch((e) => {
    process.exit(1);
  });