#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUsersAndCreateWorkflow() {
  console.log('🔍 Checking available users...\n');
  
  // Get all users
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .limit(10);
  
  if (profileError) {
    console.error('❌ Error fetching profiles:', profileError);
    return;
  }
  
  if (profiles && profiles.length > 0) {
    console.log(`📋 Found ${profiles.length} user(s):\n`);
    profiles.forEach(profile => {
      console.log(`${profile.first_name} ${profile.last_name} - ${profile.email} (ID: ${profile.id})`);
    });
    
    // Look for Phil or any user we can use
    const philUser = profiles.find(p => 
      p.email?.includes('phil') || 
      p.email?.includes('sixtyseconds') ||
      p.first_name?.toLowerCase() === 'phil'
    );
    
    const targetUser = philUser || profiles[0];
    
    console.log(`\n🎯 Using user: ${targetUser.email} (ID: ${targetUser.id})`);
    
    // Create the workflow for this user
    console.log('\n🔧 Creating Sales Analysis Workflow...\n');
    
    const workflowData = {
      id: 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8', // Use our specific ID
      user_id: targetUser.id,
      rule_name: 'Sales Analysis Workflow',
      rule_description: 'Processes Fathom meeting data and creates tasks',
      trigger_type: 'webhook',
      trigger_conditions: { webhook: true },
      action_type: 'create_task',
      action_params: {
        user_mapping: {
          'Andrew Bryce': targetUser.id,
          'Steve Gibson': targetUser.id,
          'Phil': targetUser.id,
          'Phil Robertson': targetUser.id,
          'phil@sixtyseconds.video': targetUser.id
        }
      },
      is_active: true,
      execution_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Try to insert the workflow
    const { data: workflow, error: insertError } = await supabase
      .from('user_automation_rules')
      .upsert(workflowData, { onConflict: 'id' })
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error creating workflow:', insertError);
      
      // If it already exists, just update it
      console.log('\n🔄 Attempting to update existing workflow...');
      const { data: updateData, error: updateError } = await supabase
        .from('user_automation_rules')
        .update({ 
          is_active: true,
          user_id: targetUser.id,
          action_params: workflowData.action_params
        })
        .eq('id', 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8')
        .select();
        
      if (updateError) {
        console.error('❌ Update also failed:', updateError);
      } else {
        console.log('✅ Workflow updated successfully!');
        if (updateData && updateData.length > 0) {
          console.log('\n📋 Workflow details:');
          console.log(JSON.stringify(updateData[0], null, 2));
        }
      }
    } else {
      console.log('✅ Workflow created successfully!');
      console.log('\n📋 Workflow details:');
      console.log(JSON.stringify(workflow, null, 2));
    }
    
    console.log('\n🚀 Webhook URL for Fathom:');
    console.log(`${SUPABASE_URL}/functions/v1/workflow-webhook/b224bdca-7bfa-4bc3-b30e-68e0045a64f8`);
    
  } else {
    console.log('❌ No users found in the profiles table');
  }
}

checkUsersAndCreateWorkflow();