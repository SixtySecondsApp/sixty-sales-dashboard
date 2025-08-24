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

  console.log(`Found ${splits?.length || 0} total splits`);

  for (const split of splits || []) {
    // Check if the deal exists
    const { data: deal } = await supabase
      .from('deals')
      .select('id')
      .eq('id', split.deal_id)
      .single();

    if (!deal) {
      console.log(`Found orphaned split for non-existent deal ${split.deal_id}`);
      
      // Delete the orphaned split
      const { error } = await supabase
        .from('deal_splits')
        .delete()
        .eq('id', split.id);

      if (error) {
        console.error(`Failed to delete orphaned split:`, error);
      } else {
        console.log(`✅ Deleted orphaned split ${split.id}`);
      }
    }
  }

  // Now check for Xenocor deal
  console.log('\n--- Checking for Xenocor deal ---');
  
  const { data: xenocorDeals } = await supabase
    .from('deals')
    .select('*')
    .or('name.ilike.%xenocor%,company.ilike.%xenocor%');

  if (xenocorDeals && xenocorDeals.length > 0) {
    console.log(`Found ${xenocorDeals.length} Xenocor deal(s):`);
    
    for (const deal of xenocorDeals) {
      console.log(`\nDeal: ${deal.name} (${deal.company})`);
      console.log(`- ID: ${deal.id}`);
      console.log(`- Owner ID: ${deal.owner_id}`);
      console.log(`- Value: ${deal.value}`);
      
      // Check for activities
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', deal.id);
      
      console.log(`- Activities: ${activities?.length || 0}`);
      if (activities && activities.length > 0) {
        activities.forEach(a => {
          console.log(`  * ${a.type}: ${a.details}, Amount: ${a.amount}, User: ${a.user_id}, is_split: ${a.is_split}`);
        });
      }
      
      // Check for splits
      const { data: dealSplits } = await supabase
        .from('deal_splits')
        .select('*')
        .eq('deal_id', deal.id);
      
      console.log(`- Splits: ${dealSplits?.length || 0}`);
      if (dealSplits && dealSplits.length > 0) {
        dealSplits.forEach(s => {
          console.log(`  * User: ${s.user_id}, Percentage: ${s.percentage}%`);
        });
      }
    }
  } else {
    console.log('No Xenocor deals found');
  }
}

cleanupOrphanedSplits();