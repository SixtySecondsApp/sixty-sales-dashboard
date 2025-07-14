#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function fixNullProposalAmounts() {
  try {
    console.log('🔧 Fixing proposals with null amounts...\n');

    // Find recent proposals with null amounts
    const { data: nullProposals, error: findError } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal')
      .is('amount', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('date', { ascending: false });

    if (findError) throw findError;

    console.log(`Found ${nullProposals?.length || 0} proposals with null amounts from the last 7 days`);

    if (!nullProposals || nullProposals.length === 0) {
      console.log('No proposals to fix');
      return;
    }

    // For demo purposes, let's set some reasonable amounts based on client names
    // In production, you'd want to get these from another source or set them manually
    const updates = [];
    
    nullProposals.forEach(proposal => {
      // Default amount for demos
      let amount = 5000;
      
      // You can customize based on client or other factors
      if (proposal.client_name?.toLowerCase().includes('marketing')) {
        amount = 7500;
      } else if (proposal.client_name === 'test') {
        amount = 1000;
      }
      
      updates.push({
        id: proposal.id,
        client: proposal.client_name,
        amount: amount
      });
    });

    console.log('\nProposed updates:');
    updates.forEach(u => {
      console.log(`  ${u.client}: £${u.amount}`);
    });

    // Actually update the proposals
    console.log('\n🚀 Applying updates...\n');
    
    for (const update of updates) {
      const { error } = await supabase
        .from('activities')
        .update({ amount: update.amount })
        .eq('id', update.id);
        
      if (error) {
        console.error(`Failed to update ${update.client}:`, error);
      } else {
        console.log(`✅ Updated ${update.client} with £${update.amount}`);
      }
    }
    
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixNullProposalAmounts().catch(console.error);