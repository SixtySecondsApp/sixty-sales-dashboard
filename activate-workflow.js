#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function activateWorkflow() {
  console.log('🔧 Activating workflow...\n');
  
  // Update workflow to active
  const { data, error } = await supabase
    .from('user_automation_rules')
    .update({ is_active: true })
    .eq('id', 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8')
    .select();
  
  if (error) {
    console.error('❌ Error activating workflow:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Workflow activated successfully!');
    console.log('\n📋 Workflow details:');
    console.log(JSON.stringify(data[0], null, 2));
  } else {
    console.log('⚠️ No workflow found with the specified ID');
  }
}

activateWorkflow();