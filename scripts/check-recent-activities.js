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

async function checkRecentActivities() {
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
    return;
  }
  if (recentActivities.length === 0) {
  } else {
    recentActivities.forEach(activity => {
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
    todaysActivities.forEach(act => {
    });
  }
}

checkRecentActivities();