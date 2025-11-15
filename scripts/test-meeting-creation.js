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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMeetingCreation() {
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
    return;
  }
  recentMeetings.forEach(meeting => {
    if (meeting.deal_id && meeting.deals) {
      // Check if deal was created around the same time as the meeting (within 5 seconds)
      const meetingTime = new Date(meeting.created_at);
      const dealTime = new Date(meeting.deals.created_at);
      const timeDiff = Math.abs(meetingTime - dealTime) / 1000;
      
      if (timeDiff < 5) {
      }
    } else {
    }
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
    for (const deal of recentDeals) {
      // Check if this deal has activities
      const { data: activities } = await supabase
        .from('activities')
        .select('type, created_at')
        .eq('deal_id', deal.id);
      if (activities && activities.length > 0) {
      } else {
      }
    }
  }
}

testMeetingCreation();