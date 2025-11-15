import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDealSplit() {
  const dealId = '1c44cf61-950a-4c39-a5d3-0e95573d5552';
  
  // Check deal
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();
  if (dealError) {}

  // Check activities for this deal
  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', dealId);
  if (activities && activities.length > 0) {
    activities.forEach(a => {
    });
  } else {
  }

  // Check splits
  const { data: splits } = await supabase
    .from('deal_splits')
    .select('*')
    .eq('deal_id', dealId);
  if (splits && splits.length > 0) {
    splits.forEach(s => {
    });
  } else {
  }
}

checkDealSplit();