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

async function testQuickAddComplete() {
  // Check recent activities and their linked deals
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  // Test each activity type
  const activityTypes = ['meeting', 'proposal', 'sale'];
  
  for (const type of activityTypes) {
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
      continue;
    }
    
    if (activities.length === 0) {
    } else {
      activities.forEach(activity => {
        if (activity.deal_id && activity.deals) {
          // Check if deal was created around the same time (within 10 seconds)
          const activityTime = new Date(activity.created_at);
          const dealTime = new Date(activity.deals.created_at);
          const timeDiff = Math.abs(activityTime - dealTime) / 1000;
          
          if (timeDiff < 10) {
          }
        } else {
        }
      });
    }
  }
  
  // Summary of stages for auto-created deals
}

testQuickAddComplete();