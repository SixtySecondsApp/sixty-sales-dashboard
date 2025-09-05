import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceSchemaRefresh() {
  console.log('Forcing Supabase schema refresh...\n');
  
  try {
    // Try to alter the table to add the columns if they don't exist
    const alterTableSQL = `
      -- Add missing columns if they don't exist
      ALTER TABLE public.user_automation_rules 
      ADD COLUMN IF NOT EXISTS canvas_data JSONB,
      ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS template_id TEXT,
      ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;
      
      -- Force schema cache refresh
      NOTIFY pgrst, 'reload schema';
    `;

    // Execute the SQL using RPC
    const { data: alterResult, error: alterError } = await supabase.rpc('exec_sql', {
      sql: alterTableSQL
    }).single();

    if (alterError) {
      // If the RPC doesn't exist, try another approach
      console.log('Note: Could not execute SQL via RPC. You need to run this SQL manually in Supabase Dashboard.\n');
      console.log('Please go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/editor');
      console.log('And run this SQL:\n');
      console.log('================================\n');
      console.log(alterTableSQL);
      console.log('\n================================\n');
      console.log('After running the SQL, wait 30 seconds for the schema cache to refresh, then try saving workflows again.');
      return;
    }

    console.log('✅ Schema alteration executed successfully');
    
    // Wait a moment for schema to refresh
    console.log('⏳ Waiting for schema cache to refresh...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test if it works now
    const testWorkflow = {
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      rule_name: 'Schema Test',
      rule_description: 'Testing schema',
      canvas_data: { nodes: [], edges: [] },
      trigger_type: 'manual',
      trigger_conditions: {},
      action_type: 'test',
      action_config: {},
      is_active: false,
      priority_level: 1
    };
    
    const { error: insertError } = await supabase
      .from('user_automation_rules')
      .insert(testWorkflow);
    
    if (insertError && insertError.message.includes('canvas_data')) {
      console.log('❌ Schema cache still not refreshed');
      console.log('\nThe schema cache needs to be manually refreshed in Supabase Dashboard.');
      console.log('Please follow these steps:\n');
      console.log('1. Go to: https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/editor');
      console.log('2. Run the SQL shown above');
      console.log('3. Wait 30 seconds for the cache to refresh');
      console.log('4. Try saving workflows again');
    } else if (insertError && insertError.message.includes('user_id')) {
      console.log('✅ Schema is working correctly (FK constraint expected)');
      console.log('You can now save workflows!');
    } else {
      console.log('✅ Schema refresh successful!');
      console.log('You can now save workflows!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\nPlease run the SQL manually in Supabase Dashboard as shown above.');
  }
}

forceSchemaRefresh();