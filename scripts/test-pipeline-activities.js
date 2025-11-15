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

async function testPipelineActivities() {
  // 1. Get current stages
  const { data: stages, error: stagesError } = await supabase
    .from('deal_stages')
    .select('*')
    .order('order_position');
  
  if (stagesError) {
    return;
  }
  stages.forEach(stage => {
  });
  
  // 2. Check for recent activities created from pipeline movements
  const { data: recentActivities, error: activitiesError } = await supabase
    .from('activities')
    .select('*')
    .not('deal_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (activitiesError) {
    return;
  }
  if (recentActivities.length === 0) {
  } else {
    recentActivities.forEach(activity => {
    });
  }
  
  // 3. Check for deals and their current stages
  const { data: deals, error: dealsError } = await supabase
    .from('deals')
    .select('id, name, company, stage_id, value, owner_id')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (dealsError) {
    return;
  }
  deals.forEach(deal => {
    const stage = stages.find(s => s.id === deal.stage_id);
  });
}

testPipelineActivities();