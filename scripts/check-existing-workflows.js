import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingWorkflows() {
  console.log('🔍 Checking existing workflows in the database...\n');

  try {
    // Get all existing workflows to see what values are actually in use
    const { data: workflows, error } = await supabase
      .from('user_automation_rules')
      .select('id, rule_name, trigger_type, action_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching workflows:', error);
      return;
    }

    if (!workflows || workflows.length === 0) {
      console.log('No existing workflows found in the database.');
      console.log('\n💡 This means the table might be using strict constraints that don\'t allow the values we\'re trying to insert.');
      return;
    }

    console.log(`Found ${workflows.length} workflows:\n`);
    
    // Group by trigger_type
    const triggerTypes = {};
    const actionTypes = {};
    
    workflows.forEach(w => {
      // Count trigger types
      if (!triggerTypes[w.trigger_type]) {
        triggerTypes[w.trigger_type] = [];
      }
      triggerTypes[w.trigger_type].push(w.rule_name);
      
      // Count action types
      if (!actionTypes[w.action_type]) {
        actionTypes[w.action_type] = [];
      }
      actionTypes[w.action_type].push(w.rule_name);
    });
    
    console.log('📊 Trigger Types in Use:');
    Object.entries(triggerTypes).forEach(([type, names]) => {
      console.log(`  ${type}: ${names.length} workflow(s)`);
      names.slice(0, 2).forEach(name => console.log(`    - ${name}`));
      if (names.length > 2) console.log(`    ... and ${names.length - 2} more`);
    });
    
    console.log('\n📊 Action Types in Use:');
    Object.entries(actionTypes).forEach(([type, names]) => {
      console.log(`  ${type}: ${names.length} workflow(s)`);
      names.slice(0, 2).forEach(name => console.log(`    - ${name}`));
      if (names.length > 2) console.log(`    ... and ${names.length - 2} more`);
    });
    
    console.log('\n💡 Insights:');
    console.log('- These are the ONLY trigger_type and action_type values that the database currently accepts.');
    console.log('- Any other values will be rejected by the check constraint.');
    console.log('- For form nodes, we should use one of the existing trigger types above.');
    
    // Suggest the best mapping
    const validTriggers = Object.keys(triggerTypes);
    if (validTriggers.length > 0) {
      console.log(`\n🎯 Recommendation: Map form_submission to "${validTriggers[0]}" since it's a valid trigger type.`);
    }
    
    const validActions = Object.keys(actionTypes);
    if (validActions.length > 0) {
      console.log(`🎯 Recommendation: Map ai_agent to "${validActions[0]}" since it's a valid action type.`);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkExistingWorkflows().catch(console.error);