import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function unifyDiscoveryMeetings() {
  const { data: meetings, error } = await supabase
    .from('activities')
    .select('id, details')
    .eq('type', 'meeting')
    .ilike('details', '%discovery%');

  if (error) {
    process.exit(1);
  }

  if (!meetings || meetings.length === 0) {
    return;
  }
  const ids = meetings.map((m) => m.id);

  const { error: updateError } = await supabase
    .from('activities')
    .update({ details: 'Discovery Call' })
    .in('id', ids);

  if (updateError) {
    process.exit(1);
  }
}

unifyDiscoveryMeetings()
  .then(() => process.exit(0))
  .catch((e) => {
    process.exit(1);
  }); 