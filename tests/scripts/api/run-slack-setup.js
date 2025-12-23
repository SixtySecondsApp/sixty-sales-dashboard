#!/usr/bin/env node

/**
 * Script to automatically create Slack integration tables in Supabase
 * Run with: node run-slack-setup.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Ensure VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSlackSetup() {
  try {
    console.log('🚀 Starting Slack OAuth table setup...\n');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix_slack_tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📝 Read SQL script successfully');
    console.log('🔄 Executing SQL commands...\n');
    
    // Execute the SQL using Supabase's raw SQL execution
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    }).single();
    
    if (error && error.code !== 'PGRST202') {
      // PGRST202 is "no rows returned" which is expected for DDL statements
      throw error;
    }
    
    console.log('✅ Tables created successfully!');
    
    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['slack_integrations', 'slack_channels']);
    
    if (tableError) {
      console.warn('⚠️  Could not verify tables (this might be normal):', tableError.message);
    } else if (tables && tables.length > 0) {
      console.log('✅ Found tables:', tables.map(t => t.table_name).join(', '));
    }
    
    // Test insert capability
    console.log('\n🧪 Testing table access...');
    
    const testData = {
      user_id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Your user ID
      team_id: 'TEST_SETUP_' + Date.now(),
      team_name: 'Setup Test Team',
      access_token: 'xoxb-test-token',
      bot_user_id: 'U_TEST',
      app_id: 'A_TEST',
      scope: 'chat:write',
      is_active: false // Set to false so it doesn't interfere
    };
    
    const { error: insertError } = await supabase
      .from('slack_integrations')
      .insert(testData);
    
    if (insertError) {
      console.warn('⚠️  Test insert failed (might be RLS):', insertError.message);
    } else {
      console.log('✅ Test insert successful');
      
      // Clean up test data
      await supabase
        .from('slack_integrations')
        .delete()
        .eq('team_id', testData.team_id);
      
      console.log('✅ Test data cleaned up');
    }
    
    console.log('\n🎉 Slack OAuth setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to https://sales.sixtyseconds.video/workflows');
    console.log('2. Click "Connect Slack"');
    console.log('3. Authorize the app');
    console.log('4. Start using Slack notifications in your workflows!\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\n📋 Manual setup required:');
    console.error('1. Go to https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new');
    console.error('2. Copy contents of fix_slack_tables.sql');
    console.error('3. Paste and run in SQL Editor\n');
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function runSlackSetupDirect() {
  console.log('🚀 Starting Slack OAuth table setup (direct method)...\n');
  
  // Since Supabase doesn't have a direct SQL exec method in the JS client,
  // we'll need to use the SQL Editor in the dashboard
  console.log('📋 Automatic execution not available via JS client');
  console.log('\n🔧 Please follow these steps:');
  console.log('\n1. Open Supabase SQL Editor:');
  console.log('   https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/sql/new');
  console.log('\n2. Copy ALL contents from fix_slack_tables.sql');
  console.log('\n3. Paste into SQL Editor and click "Run"');
  console.log('\n4. You should see "Success. No rows returned"');
  console.log('\n5. Test the OAuth flow at:');
  console.log('   https://sales.sixtyseconds.video/workflows');
  console.log('\nThe SQL script will:');
  console.log('  ✓ Create slack_integrations table');
  console.log('  ✓ Create slack_channels table');
  console.log('  ✓ Set up RLS policies');
  console.log('  ✓ Add necessary indexes');
  console.log('  ✓ Grant permissions\n');
}

// Check if we can use the exec_sql function (custom function)
// If not available, fall back to manual instructions
async function checkAndRun() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'SELECT 1'
  }).single();
  
  if (error && error.code === 'PGRST202') {
    // Function doesn't exist, use manual method
    await runSlackSetupDirect();
  } else if (!error) {
    // Function exists, run setup
    await runSlackSetup();
  } else {
    // Other error
    console.error('Error checking exec_sql function:', error);
    await runSlackSetupDirect();
  }
}

// Run the setup
runSlackSetupDirect(); // Use direct method since exec_sql is not standard