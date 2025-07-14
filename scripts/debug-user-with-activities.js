#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client with service role
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function debugUserWithActivities() {
  try {
    console.log('🔍 Finding user with proposal activities...\n');

    // Find a user who has proposals with amounts
    const { data: userWithProposals, error: findError } = await supabase
      .from('activities')
      .select('user_id, sales_rep')
      .eq('type', 'proposal')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .limit(1)
      .single();

    if (findError || !userWithProposals) {
      console.log('No users with proposal amounts found');
      return;
    }

    const userId = userWithProposals.user_id;
    console.log(`Found user: ${userWithProposals.sales_rep} (${userId.substring(0, 8)}...)`);

    // Now fetch activities like the useActivities hook
    console.log('\n📊 Fetching activities using the same query as useActivities:');
    
    const { data, error } = await supabase
      .from('activities')
      .select(`
        *,
        deals (
          id,
          name,
          value,
          one_off_revenue,
          monthly_mrr,
          annual_value,
          stage_id
        )
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Query error:', error);
      return;
    }

    console.log(`Total activities fetched: ${data?.length || 0}`);

    // Apply the redundant filter from line 62
    const filteredData = data?.filter(activity => activity.user_id === userId) || [];
    console.log(`After redundant filter: ${filteredData.length} activities`);

    // Check proposals
    const proposals = filteredData.filter(a => a.type === 'proposal');
    console.log(`\nProposals found: ${proposals.length}`);

    if (proposals.length > 0) {
      console.log('\n📝 First 5 proposals with their amounts:');
      proposals.slice(0, 5).forEach((prop, i) => {
        console.log(`\n${i + 1}. ${prop.client_name}`);
        console.log(`   Raw amount value: ${prop.amount}`);
        console.log(`   Amount type: ${typeof prop.amount}`);
        console.log(`   Amount > 0: ${prop.amount > 0}`);
        console.log(`   Status: ${prop.status}`);
        console.log(`   Date: ${new Date(prop.date).toLocaleDateString()}`);
        
        // Check what formatActivityAmount would return
        const hasAmount = prop.amount !== null && prop.amount !== undefined && prop.amount > 0;
        console.log(`   Would display amount: ${hasAmount ? 'YES' : 'NO'}`);
      });
    }

    // Check all activities with amounts
    const withAmounts = filteredData.filter(a => a.amount > 0);
    console.log(`\n💰 Activities with amounts > 0: ${withAmounts.length}`);
    
    // Group by type
    const byType = {};
    withAmounts.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });
    
    console.log('\nBreakdown by type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run debug
debugUserWithActivities().catch(console.error);