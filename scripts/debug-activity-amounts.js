#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function debugActivityAmounts() {
  try {
    console.log('🔍 Debugging activity amounts...\n');

    // Get a specific proposal with amount
    const { data: specificProposals, error: specError } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .limit(5);

    if (specError) throw specError;

    console.log('Proposals with amounts (direct query):');
    console.log('----------------------------------------');
    specificProposals?.forEach(p => {
      console.log(`Client: ${p.client_name}`);
      console.log(`Amount: £${p.amount}`);
      console.log(`Date: ${new Date(p.date).toLocaleDateString()}`);
      console.log(`ID: ${p.id}`);
      console.log('---');
    });

    // Now test the same query structure as useActivities
    console.log('\nUsing the same query as useActivities hook:');
    console.log('----------------------------------------');
    
    const { data: activitiesWithJoin, error: joinError } = await supabase
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
      .eq('type', 'proposal')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .order('date', { ascending: false })
      .limit(5);

    if (joinError) throw joinError;

    activitiesWithJoin?.forEach(activity => {
      console.log(`Client: ${activity.client_name}`);
      console.log(`Amount field value: ${activity.amount}`);
      console.log(`Type: ${typeof activity.amount}`);
      console.log(`Has deal: ${activity.deal_id ? 'Yes' : 'No'}`);
      console.log('---');
    });

    // Check the table schema
    console.log('\nChecking table schema...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'activities' });

    if (!tableError && tableInfo) {
      const amountColumn = tableInfo.find(col => col.column_name === 'amount');
      if (amountColumn) {
        console.log('Amount column info:', amountColumn);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the debug
debugActivityAmounts().catch(console.error);