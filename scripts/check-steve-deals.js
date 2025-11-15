import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSteveDeals() {
  // First find Steve's user ID
  const { data: steve } = await supabase
    .from('profiles')
    .select('*')
    .eq('first_name', 'Steve')
    .single();
  if (steve) {
    // Get Steve's deals
    const { data: deals } = await supabase
      .from('deals')
      .select('*')
      .eq('owner_id', steve.id);
    if (deals && deals.length > 0) {
      deals.forEach(d => {
      });
    } else {
    }

    // Get Steve's activities
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', steve.id)
      .eq('type', 'sale');
    if (activities && activities.length > 0) {
      activities.forEach(a => {
      });
    } else {
    }
  }

  // Check for any splits with Andrew
  const { data: andrew } = await supabase
    .from('profiles')
    .select('*')
    .eq('first_name', 'Andrew')
    .single();

  if (andrew) {
    const { data: andrewActivities } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', andrew.id)
      .eq('type', 'sale');

    if (andrewActivities && andrewActivities.length > 0) {
      andrewActivities.forEach(a => {
      });
    } else {
    }
  }

  // Check all deal splits
  const { data: allSplits } = await supabase
    .from('deal_splits_with_users')
    .select('*');
  if (allSplits && allSplits.length > 0) {
    allSplits.forEach(s => {
    });
  } else {
  }
}

checkSteveDeals();