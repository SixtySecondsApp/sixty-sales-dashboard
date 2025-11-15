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

async function checkExistingWorkflows() {
  try {
    // Get all existing workflows to see what values are actually in use
    const { data: workflows, error } = await supabase
      .from('user_automation_rules')
      .select('id, rule_name, trigger_type, action_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return;
    }

    if (!workflows || workflows.length === 0) {
      return;
    }
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
    Object.entries(triggerTypes).forEach(([type, names]) => {
      names.slice(0, 2).forEach(name => undefined);
      if (names.length > 2) {}
    });
    Object.entries(actionTypes).forEach(([type, names]) => {
      names.slice(0, 2).forEach(name => undefined);
      if (names.length > 2) {}
    });
    // Suggest the best mapping
    const validTriggers = Object.keys(triggerTypes);
    if (validTriggers.length > 0) {
    }
    
    const validActions = Object.keys(actionTypes);
    if (validActions.length > 0) {
    }
    
  } catch (error) {
  }
}

// Run the check
checkExistingWorkflows().catch(console.error);