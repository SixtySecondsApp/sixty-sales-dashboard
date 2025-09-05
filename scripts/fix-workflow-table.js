import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixTable() {
  console.log('Checking user_automation_rules table structure...');
  
  try {
    // First, try to select from the table to see what columns exist
    const { data, error } = await supabase
      .from('user_automation_rules')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error checking table:', error);
      
      if (error.message.includes('canvas_data')) {
        console.log('\n❌ Missing canvas_data column');
        console.log('\nPlease run the following SQL in your Supabase Dashboard SQL editor:\n');
        console.log('----------------------------------------');
        console.log(`
-- Add missing columns to user_automation_rules table
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS canvas_data JSONB,
ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id TEXT,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
        `);
        console.log('----------------------------------------');
      }
    } else {
      console.log('✅ Table structure appears correct');
      
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
        console.error('Insert test error:', insertError);
      } else {
        console.log('✅ All columns are working correctly');
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAndFixTable();