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
    // Get a specific proposal with amount
    const { data: specificProposals, error: specError } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .limit(5);

    if (specError) throw specError;
    specificProposals?.forEach(p => {
    });

    // Now test the same query structure as useActivities
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
    });

    // Check the table schema
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'activities' });

    if (!tableError && tableInfo) {
      const amountColumn = tableInfo.find(col => col.column_name === 'amount');
      if (amountColumn) {
      }
    }

  } catch (error) {
  }
}

// Run the debug
debugActivityAmounts().catch(console.error);