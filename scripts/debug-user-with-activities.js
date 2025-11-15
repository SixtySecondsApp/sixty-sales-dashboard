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
      return;
    }

    const userId = userWithProposals.user_id;
    // Now fetch activities like the useActivities hook
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
      return;
    }
    // Apply the redundant filter from line 62
    const filteredData = data?.filter(activity => activity.user_id === userId) || [];
    // Check proposals
    const proposals = filteredData.filter(a => a.type === 'proposal');
    if (proposals.length > 0) {
      proposals.slice(0, 5).forEach((prop, i) => {
        // Check what formatActivityAmount would return
        const hasAmount = prop.amount !== null && prop.amount !== undefined && prop.amount > 0;
      });
    }

    // Check all activities with amounts
    const withAmounts = filteredData.filter(a => a.amount > 0);
    // Group by type
    const byType = {};
    withAmounts.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });
    Object.entries(byType).forEach(([type, count]) => {
    });

  } catch (error) {
  }
}

// Run debug
debugUserWithActivities().catch(console.error);