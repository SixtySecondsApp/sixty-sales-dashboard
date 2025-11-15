import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupOrphanedSplits() {
  // Find all deal splits
  const { data: splits } = await supabase
    .from('deal_splits')
    .select('*');
  for (const split of splits || []) {
    // Check if the deal exists
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('id', split.deal_id)
      .single();

    if (!deal) {
      // Delete the orphaned split
      const { error } = await supabase
        .from('deal_splits')
        .delete()
        .eq('id', split.id);

      if (error) {
      } else {
      }
    }
  }

  // Now check for Xenocor deal
  const { data: xenocorDeals } = await supabase
    .from('deals')
    .select('*')
    .or('name.ilike.%xenocor%,company.ilike.%xenocor%');

  if (xenocorDeals && xenocorDeals.length > 0) {
    for (const deal of xenocorDeals) {
      // Check for activities
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', deal.id);
      if (activities && activities.length > 0) {
        activities.forEach(a => {
        });
      }
      
      // Check for splits
      const { data: dealSplits } = await supabase
        .from('deal_splits')
        .select('*')
        .eq('deal_id', deal.id);
      if (dealSplits && dealSplits.length > 0) {
        dealSplits.forEach(s => {
        });
      }
    }
  } else {
  }
}

cleanupOrphanedSplits();