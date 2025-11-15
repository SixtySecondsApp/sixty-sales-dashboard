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
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
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
        await debugUserActivities(supabaseAdmin, sampleUser.id);
      }
      return;
    }
    await debugUserActivities(supabase, user.id);

  } catch (error) {
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
    return;
  }
  // Filter and check proposals
  const proposals = data?.filter(a => a.type === 'proposal') || [];
  if (proposals.length > 0) {
    proposals.slice(0, 5).forEach((prop, i) => {
      if (prop.deals) {
      }
    });
  }

  // Check for activities with amounts
  const withAmounts = data?.filter(a => a.amount > 0) || [];
  if (withAmounts.length > 0) {
    withAmounts.slice(0, 3).forEach(act => {
    });
  }

  // Check data after the filter that's on line 62
  const filteredData = data?.filter(activity => activity.user_id === userId) || [];
  // This filter is redundant since we already queried by user_id
  if (data?.length !== filteredData.length) {
  }
}

// Run debug
debugCurrentUserActivities().catch(console.error);