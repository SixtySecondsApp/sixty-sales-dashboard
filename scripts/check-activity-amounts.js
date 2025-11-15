#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkActivityAmounts() {
  try {
    // Get all activities
    const { data: activities, error } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        client_name,
        amount,
        deal_id,
        date,
        status,
        deals (
          id,
          name,
          value,
          one_off_revenue,
          monthly_mrr,
          annual_value
        )
      `)
      .order('date', { ascending: false })
      .limit(20);

    if (error) throw error;
    activities.forEach(activity => {
      const type = activity.type.padEnd(8);
      const client = (activity.client_name || 'Unknown').substring(0, 25).padEnd(25);
      const amount = activity.amount 
        ? `£${activity.amount.toLocaleString()}`.padEnd(9)
        : '-'.padEnd(9);
      const dealInfo = activity.deals ? 'Linked' : (activity.deal_id ? `ID:${activity.deal_id.substring(0,6)}` : 'None');
      const dealCol = dealInfo.padEnd(9);
      const status = (activity.status || 'unknown').padEnd(8);
      if (activity.deals) {
      }
    });

    // Get summary of proposals specifically
    const { data: proposals, error: propError } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'proposal');

    if (!propError && proposals) {
      const withAmount = proposals.filter(p => p.amount > 0).length;
      const withDeal = proposals.filter(p => p.deal_id).length;
    }

  } catch (error) {
  }
}

// Run the check
checkActivityAmounts().catch(console.error);