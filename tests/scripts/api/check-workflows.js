#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkWorkflows() {
  console.log('🔍 Looking for workflows...\n');
  
  // First get Andrew's user ID
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', 'andrew.bryce@sixtyseconds.video');
  
  if (profileError) {
    console.error('❌ Error finding user:', profileError);
    return;
  }
  
  if (profiles && profiles.length > 0) {
    const andrewUserId = profiles[0].id;
    console.log(`✅ Found Andrew's user ID: ${andrewUserId}\n`);
    
    // Now get all workflows for Andrew
    const { data: workflows, error: workflowError } = await supabase
      .from('user_automation_rules')
      .select('*')
      .eq('user_id', andrewUserId);
    
    if (workflowError) {
      console.error('❌ Error fetching workflows:', workflowError);
      return;
    }
    
    if (workflows && workflows.length > 0) {
      console.log(`📋 Found ${workflows.length} workflow(s) for Andrew:\n`);
      workflows.forEach(workflow => {
        console.log(`ID: ${workflow.id}`);
        console.log(`Name: ${workflow.rule_name}`);
        console.log(`Active: ${workflow.is_active}`);
        console.log(`Created: ${workflow.created_at}`);
        console.log('---');
      });
    } else {
      console.log('⚠️ No workflows found for Andrew');
      console.log('\n🔧 Let\'s create a new workflow...');
    }
  } else {
    console.log('❌ User not found: andrew.bryce@sixtyseconds.video');
  }
}

checkWorkflows();