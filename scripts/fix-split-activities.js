import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSplitActivities() {
  try {
    console.log('Checking for deal splits without activities...');
    
    // Get all deal splits
    const { data: splits, error: splitsError } = await supabase
      .from('deal_splits_with_users')
      .select('*');
    
    if (splitsError) {
      console.error('Error fetching splits:', splitsError);
      return;
    }
    
    console.log(`Found ${splits.length} deal splits`);
    
    for (const split of splits) {
      console.log(`\nChecking split for deal ${split.deal_id}, user ${split.user_id} (${split.percentage}%)`);
      
      // Check if split activity exists
      const { data: splitActivity } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', split.deal_id)
        .eq('user_id', split.user_id)
        .eq('is_split', true)
        .single();
      
      if (!splitActivity) {
        console.log(`  ❌ No split activity found for user ${split.full_name}`);
        
        // Get the deal details
        const { data: deal } = await supabase
          .from('deals')
          .select('*')
          .eq('id', split.deal_id)
          .single();
        
        if (deal) {
          console.log(`  📦 Deal: ${deal.name} (${deal.company}), Value: ${deal.value}`);
          
          // Check if there's an original activity
          const { data: originalActivity } = await supabase
            .from('activities')
            .select('*')
            .eq('deal_id', split.deal_id)
            .eq('type', 'sale')
            .is('is_split', null)
            .single();
          
          if (originalActivity) {
            console.log(`  ✅ Found original activity for ${originalActivity.client_name}`);
            
            // Create the missing split activity
            const splitAmount = deal.value * (split.percentage / 100);
            const baseDetails = originalActivity.details?.replace(/ \(\d+% retained after split\)/, '').replace(/ \(\d+% split\)/, '') || 'Sale';
            
            const newSplitActivity = {
              user_id: split.user_id,
              type: 'sale',
              client_name: originalActivity.client_name,
              details: `${baseDetails} (${split.percentage}% split)`,
              amount: splitAmount,
              priority: originalActivity.priority || 'high',
              sales_rep: split.full_name,
              date: originalActivity.date,
              status: originalActivity.status || 'completed',
              quantity: originalActivity.quantity || 1,
              contact_identifier: originalActivity.contact_identifier,
              contact_identifier_type: originalActivity.contact_identifier_type,
              deal_id: split.deal_id,
              is_split: true,
              original_activity_id: originalActivity.id,
              split_percentage: split.percentage
            };
            
            const { error: createError } = await supabase
              .from('activities')
              .insert([newSplitActivity]);
            
            if (createError) {
              console.error(`  ❌ Failed to create split activity:`, createError);
            } else {
              console.log(`  ✅ Created split activity for ${split.full_name} (${splitAmount})`);
              
              // Now update the original activity
              const { data: allSplits } = await supabase
                .from('deal_splits')
                .select('percentage')
                .eq('deal_id', split.deal_id);
              
              const totalSplitPercentage = allSplits.reduce((sum, s) => sum + s.percentage, 0);
              const ownerPercentage = 100 - totalSplitPercentage;
              const ownerAmount = deal.value * (ownerPercentage / 100);
              
              const updatedDetails = `${baseDetails} (${ownerPercentage}% retained after split)`;
              
              const { error: updateError } = await supabase
                .from('activities')
                .update({
                  details: updatedDetails,
                  amount: ownerAmount,
                  split_percentage: ownerPercentage
                })
                .eq('id', originalActivity.id);
              
              if (updateError) {
                console.error(`  ❌ Failed to update original activity:`, updateError);
              } else {
                console.log(`  ✅ Updated original activity to ${ownerPercentage}% (${ownerAmount})`);
              }
            }
          } else {
            console.log(`  ⚠️  No original activity found for this deal`);
          }
        }
      } else {
        console.log(`  ✅ Split activity already exists`);
      }
    }
    
    console.log('\n✅ Finished checking and fixing split activities');
    
  } catch (error) {
    console.error('Error fixing split activities:', error);
  }
}

fixSplitActivities();