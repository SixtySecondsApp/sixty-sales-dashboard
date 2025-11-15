import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixTable() {
  try {
    // First, try to select from the table to see what columns exist
    const { data, error } = await supabase
      .from('user_automation_rules')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('canvas_data')) {
      }
    } else {
      // Try to insert a test workflow to verify all columns work
      const testWorkflow = {
        user_id: 'test-user-id', // This will fail due to FK constraint, but that's okay
        rule_name: 'Test Workflow',
        rule_description: 'Test',
        canvas_data: { nodes: [], edges: [] },
        trigger_type: 'manual',
        trigger_conditions: {},
        action_type: 'create_task',
        action_config: {},
        is_active: false,
        priority_level: 1
      };
      
      const { error: insertError } = await supabase
        .from('user_automation_rules')
        .insert(testWorkflow);
      
      if (insertError && !insertError.message.includes('user_id')) {
      } else {
      }
    }
    
  } catch (error) {
  }
}

checkAndFixTable();