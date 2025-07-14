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
    console.log('🔍 Testing user activities query...\n');

    // Get all users who have activities
    const { data: users, error: usersError } = await supabase
      .from('activities')
      .select('user_id, sales_rep')
      .not('user_id', 'is', null)
      .limit(5);

    if (usersError) throw usersError;

    console.log('Sample users with activities:');
    users?.forEach(u => console.log(`- User ID: ${u.user_id?.substring(0, 8)}... Rep: ${u.sales_rep}`));

    // Get activities for the first user
    if (users && users.length > 0) {
      const testUserId = users[0].user_id;
      console.log(`\nFetching activities for user: ${testUserId.substring(0, 8)}...`);

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

      console.log(`\nFound ${userActivities?.length || 0} proposals for this user:`);
      userActivities?.forEach(activity => {
        console.log(`\nClient: ${activity.client_name}`);
        console.log(`Amount: ${activity.amount ? `£${activity.amount}` : 'null'}`);
        console.log(`Status: ${activity.status}`);
        console.log(`Date: ${new Date(activity.date).toLocaleDateString()}`);
        console.log(`Has deal: ${activity.deal_id ? 'Yes' : 'No'}`);
      });
    }

    // Check if there are any recent activities with amounts
    console.log('\n\nRecent activities with amounts (any user):');
    const { data: recentWithAmounts, error: recentError } = await supabase
      .from('activities')
      .select('client_name, amount, type, sales_rep, date')
      .not('amount', 'is', null)
      .gt('amount', 0)
      .order('date', { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    recentWithAmounts?.forEach(a => {
      console.log(`${new Date(a.date).toLocaleDateString()} - ${a.type} - ${a.client_name} - £${a.amount} - ${a.sales_rep}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testUserActivities().catch(console.error);