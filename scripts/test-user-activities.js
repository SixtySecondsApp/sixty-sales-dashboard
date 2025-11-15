#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testUserActivities() {
  try {
    // Get all users who have activities
    const { data: users, error: usersError } = await supabase
      .from('activities')
      .select('user_id, sales_rep')
      .not('user_id', 'is', null)
      .limit(5);

    if (usersError) throw usersError;
    users?.forEach(u => undefined);

    // Get activities for the first user
    if (users && users.length > 0) {
      const testUserId = users[0].user_id;
      const { data: userActivities, error: activitiesError } = await supabase
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
        .eq('user_id', testUserId)
        .eq('type', 'proposal')
        .order('date', { ascending: false })
        .limit(10);

      if (activitiesError) throw activitiesError;
      userActivities?.forEach(activity => {
      });
    }

    // Check if there are any recent activities with amounts
    const { data: recentWithAmounts, error: recentError } = await supabase
      .from('activities')
      .select('client_name, amount, type, sales_rep, date')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .order('date', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    recentWithAmounts?.forEach(a => {
    });

  } catch (error) {
  }
}

// Run the test
testUserActivities().catch(console.error);