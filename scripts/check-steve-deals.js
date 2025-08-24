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

  console.log('Steve profile:', steve);

  if (steve) {
    // Get Steve's deals
    const { data: deals } = await supabase
      .from('deals')
      .select('*')
      .eq('owner_id', steve.id);

    console.log('\nSteve\'s deals:');
    if (deals && deals.length > 0) {
      deals.forEach(d => {
        console.log(`- ID: ${d.id}, Name: ${d.name}, Company: ${d.company}, Value: ${d.value}`);
      });
    } else {
      console.log('No deals found');
    }

    // Get Steve's activities
    const { data: activities } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', steve.id)
      .eq('type', 'sale');

    console.log('\nSteve\'s sale activities:');
    if (activities && activities.length > 0) {
      activities.forEach(a => {
        console.log(`- Client: ${a.client_name}, Amount: ${a.amount}, Details: ${a.details}, Deal ID: ${a.deal_id}, is_split: ${a.is_split}`);
      });
    } else {
      console.log('No sale activities found');
    }
  }

  // Check for any splits with Andrew
  const { data: andrew } = await supabase
    .from('profiles')
    .select('*')
    .eq('first_name', 'Andrew')
    .single();

  if (andrew) {
    console.log('\nAndrew\'s sale activities:');
    const { data: andrewActivities } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', andrew.id)
      .eq('type', 'sale');

    if (andrewActivities && andrewActivities.length > 0) {
      andrewActivities.forEach(a => {
        console.log(`- Client: ${a.client_name}, Amount: ${a.amount}, Details: ${a.details}, Deal ID: ${a.deal_id}, is_split: ${a.is_split}`);
      });
    } else {
      console.log('No sale activities found for Andrew');
    }
  }

  // Check all deal splits
  const { data: allSplits } = await supabase
    .from('deal_splits_with_users')
    .select('*');

  console.log('\nAll deal splits in system:');
  if (allSplits && allSplits.length > 0) {
    allSplits.forEach(s => {
      console.log(`- Deal: ${s.deal_id}, User: ${s.full_name}, Percentage: ${s.percentage}%`);
    });
  } else {
    console.log('No splits found');
  }
}

checkSteveDeals();