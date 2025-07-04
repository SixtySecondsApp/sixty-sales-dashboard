#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY // Use anon key to simulate frontend
);

async function debugCurrentUserActivities() {
  try {
    console.log('🔍 Debugging current user activities...\n');

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ No authenticated user found. Using service role key...');
      // Switch to service role for testing
      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Get a sample user
      const { data: sampleUser } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .limit(1)
        .single();
        
      if (sampleUser) {
        console.log(`Using sample user: ${sampleUser.first_name} ${sampleUser.last_name}`);
        await debugUserActivities(supabaseAdmin, sampleUser.id);
      }
      return;
    }

    console.log(`Current user: ${user.email} (${user.id})`);
    await debugUserActivities(supabase, user.id);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function debugUserActivities(client, userId) {
  // Fetch activities exactly like useActivities hook
  const { data, error } = await client
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

  console.log(`\nTotal activities for user: ${data?.length || 0}`);
  
  // Filter and check proposals
  const proposals = data?.filter(a => a.type === 'proposal') || [];
  console.log(`Total proposals: ${proposals.length}`);
  
  if (proposals.length > 0) {
    console.log('\nFirst 5 proposals:');
    proposals.slice(0, 5).forEach((prop, i) => {
      console.log(`\n${i + 1}. ${prop.client_name}`);
      console.log(`   Date: ${new Date(prop.date).toLocaleDateString()}`);
      console.log(`   Amount: ${prop.amount}`);
      console.log(`   Type: ${typeof prop.amount}`);
      console.log(`   Has Deal: ${prop.deal_id ? 'Yes' : 'No'}`);
      if (prop.deals) {
        console.log(`   Deal Value: ${prop.deals.value}`);
        console.log(`   Deal One-off: ${prop.deals.one_off_revenue}`);
        console.log(`   Deal MRR: ${prop.deals.monthly_mrr}`);
      }
    });
  }

  // Check for activities with amounts
  const withAmounts = data?.filter(a => a.amount > 0) || [];
  console.log(`\n\nActivities with amounts: ${withAmounts.length}`);
  
  if (withAmounts.length > 0) {
    console.log('\nSample activities with amounts:');
    withAmounts.slice(0, 3).forEach(act => {
      console.log(`- ${act.type}: ${act.client_name} - £${act.amount}`);
    });
  }

  // Check data after the filter that's on line 62
  const filteredData = data?.filter(activity => activity.user_id === userId) || [];
  console.log(`\nAfter redundant filter: ${filteredData.length} activities`);
  
  // This filter is redundant since we already queried by user_id
  if (data?.length !== filteredData.length) {
    console.log('⚠️  WARNING: Redundant filter is removing activities!');
  }
}

// Run debug
debugCurrentUserActivities().catch(console.error);