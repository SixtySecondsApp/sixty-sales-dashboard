import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
  try {
    // Query the information schema to get constraint definitions
    const { data: constraints, error: constraintError } = await supabase
      .rpc('get_table_constraints', {
        table_name_param: 'user_automation_rules'
      })
      .single();

    if (constraintError) {
      // If the function doesn't exist, try a direct query
      // Try to query pg_constraint directly
      const { data: pgConstraints, error: pgError } = await supabase
        .from('pg_constraint')
        .select('*')
        .like('conname', '%user_automation_rules%');
      
      if (pgError) {
        // Test what values are actually accepted
        await testTriggerTypes();
        return;
      }
      return;
    }
  } catch (error) {
    // Fall back to testing what values work
    await testTriggerTypes();
  }
}

async function testTriggerTypes() {
  // Values we expect to work based on migrations
  const expectedValidTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed', 'manual'];
  
  // Additional values to test
  const additionalTypes = ['form_submission', 'workflow_trigger', 'custom', 'api_trigger'];
  
  // All types to test
  const allTypes = [...expectedValidTypes, ...additionalTypes];
  
  const results = [];
  
  for (const triggerType of allTypes) {
    try {
      // Try to insert a test record with this trigger type
      const testData = {
        user_id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Test user ID
        rule_name: `Test Rule - ${triggerType}`,
        rule_description: 'Testing constraint',
        trigger_type: triggerType,
        trigger_conditions: {},
        action_type: 'create_task',
        action_config: {},
        is_active: false,
        priority_level: 1,
        canvas_data: {}
      };
      
      const { data, error } = await supabase
        .from('user_automation_rules')
        .insert(testData)
        .select()
        .single();
      
      if (error) {
        if (error.message.includes('violates check constraint')) {
          results.push({ type: triggerType, status: '❌ REJECTED', error: error.message });
        } else {
          results.push({ type: triggerType, status: '⚠️ OTHER ERROR', error: error.message });
        }
      } else {
        results.push({ type: triggerType, status: '✅ ACCEPTED', id: data.id });
        
        // Clean up test record
        await supabase
          .from('user_automation_rules')
          .delete()
          .eq('id', data.id);
      }
    } catch (error) {
      results.push({ type: triggerType, status: '⚠️ ERROR', error: error.message });
    }
  }
  expectedValidTypes.forEach(type => {
    const result = results.find(r => r.type === type);
    if (result?.error) {}
  });
  additionalTypes.forEach(type => {
    const result = results.find(r => r.type === type);
    if (result?.error) {}
  });
  
  // Now test action_type values
  await testActionTypes();
}

async function testActionTypes() {
  // Values we expect to work based on migrations
  const expectedValidTypes = ['create_deal', 'update_deal_stage', 'create_task', 'create_activity', 'send_notification', 'update_field'];
  
  // Additional values to test
  const additionalTypes = ['ai_agent', 'form_response', 'webhook', 'custom'];
  
  const allTypes = [...expectedValidTypes, ...additionalTypes];
  
  const results = [];
  
  for (const actionType of allTypes) {
    try {
      const testData = {
        user_id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
        rule_name: `Test Rule - ${actionType}`,
        rule_description: 'Testing constraint',
        trigger_type: 'manual', // Use a known valid trigger type
        trigger_conditions: {},
        action_type: actionType,
        action_config: {},
        is_active: false,
        priority_level: 1,
        canvas_data: {}
      };
      
      const { data, error } = await supabase
        .from('user_automation_rules')
        .insert(testData)
        .select()
        .single();
      
      if (error) {
        if (error.message.includes('violates check constraint')) {
          results.push({ type: actionType, status: '❌ REJECTED', error: error.message });
        } else {
          results.push({ type: actionType, status: '⚠️ OTHER ERROR', error: error.message });
        }
      } else {
        results.push({ type: actionType, status: '✅ ACCEPTED', id: data.id });
        
        // Clean up
        await supabase
          .from('user_automation_rules')
          .delete()
          .eq('id', data.id);
      }
    } catch (error) {
      results.push({ type: actionType, status: '⚠️ ERROR', error: error.message });
    }
  }
  expectedValidTypes.forEach(type => {
    const result = results.find(r => r.type === type);
    if (result?.error) {}
  });
  additionalTypes.forEach(type => {
    const result = results.find(r => r.type === type);
    if (result?.error) {}
  });
}

// Run the check
checkConstraints().catch(console.error);