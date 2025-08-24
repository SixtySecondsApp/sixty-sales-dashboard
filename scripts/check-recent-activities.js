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

async function checkRecentActivities() {
  console.log('🔍 Checking Recent Activities Created from Pipeline Movements\n');
  
  // Get activities created in the last hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  const { data: recentActivities, error } = await supabase
    .from('activities')
    .select(`
      *,
      deals (
        id,
        name,
        company,
        stage_id
      )
    `)
    .not('deal_id', 'is', null)
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching activities:', error);
    return;
  }
  
  console.log(`Found ${recentActivities.length} deal-related activities created in the last hour:\n`);
  
  if (recentActivities.length === 0) {
    console.log('No recent activities found.');
  } else {
    recentActivities.forEach(activity => {
      console.log(`📌 ${activity.type.toUpperCase()} Activity`);
      console.log(`   Client: ${activity.client_name}`);
      console.log(`   Details: ${activity.details}`);
      console.log(`   Amount: $${activity.amount || 0}`);
      console.log(`   Deal: ${activity.deals?.name || activity.deals?.company || 'Unknown'} (${activity.deal_id})`);
      console.log(`   Created: ${new Date(activity.created_at).toLocaleString()}`);
      console.log(`   Status: ${activity.status}`);
      console.log('');
    });
  }
  
  // Check for today's activities specifically
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todaysActivities, error: todayError } = await supabase
    .from('activities')
    .select('type, client_name, deal_id, created_at')
    .gte('created_at', today.toISOString())
    .eq('type', 'proposal')
    .order('created_at', { ascending: false });
  
  if (!todayError && todaysActivities) {
    console.log(`\n📅 Today's Proposal Activities: ${todaysActivities.length} found`);
    todaysActivities.forEach(act => {
      console.log(`   - ${act.client_name} at ${new Date(act.created_at).toLocaleTimeString()}`);
    });
  }
}

checkRecentActivities();