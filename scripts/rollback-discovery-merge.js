import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function rollbackDiscoveryMerge() {
  // Show current Discovery count for reference
  const { data: discoveryData, count: discoveryCount, error } = await supabase
    .from('activities')
    .select('id', { count: 'exact' })
    .eq('type', 'meeting')
    .eq('details', 'Discovery');

  if (!error && discoveryCount !== null) {
  }
}

rollbackDiscoveryMerge()
  .then(() => process.exit(0))
  .catch((e) => {
    process.exit(1);
  });