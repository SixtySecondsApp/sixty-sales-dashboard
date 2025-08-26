import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getStageIds() {
  const { data: stages, error } = await supabase
    .from('deal_stages')
    .select('id, name')
    .order('name');
  
  if (error) {
    console.error('Error fetching stages:', error);
    return;
  }
  
  console.log('Deal Stages:');
  if (stages) {
    stages.forEach(s => console.log(`  ${s.name}: '${s.id}'`));
  }
}

getStageIds();