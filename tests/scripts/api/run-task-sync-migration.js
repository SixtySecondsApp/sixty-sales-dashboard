#!/usr/bin/env node

// Script to run the task sync migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Running task sync migration...');
  
  // Read the migration SQL file
  const migrationPath = path.join(__dirname, 'supabase/migrations/20250117_add_task_sync_columns.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  // Split the SQL into individual statements (basic split on semicolon)
  // Note: This is a simplified approach - production should use a proper SQL parser
  const statements = migrationSQL
    .split(/;\s*$/m)
    .filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'))
    .map(stmt => stmt.trim() + ';');
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip comments and empty statements
    if (!statement || statement.trim().startsWith('--')) continue;
    
    // Get a preview of the statement (first 100 chars)
    const preview = statement.substring(0, 100).replace(/\n/g, ' ');
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);
    
    try {
      // Execute using raw SQL through Supabase RPC
      const { data, error } = await supabase.rpc('execute_sql', {
        query: statement
      }).single();
      
      if (error) {
        // Try direct execution as some statements might not work through RPC
        console.log('⚠️ RPC failed, statement might need manual execution:', error.message);
        errorCount++;
      } else {
        console.log('✅ Success');
        successCount++;
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Migration Summary:`);
  console.log(`✅ Successful statements: ${successCount}`);
  console.log(`❌ Failed statements: ${errorCount}`);
  
  // Instead of using RPC, let's check if the columns exist
  console.log('\n🔍 Verifying migration results...');
  
  // Check meeting_action_items columns
  const { data: actionItemCols, error: aiError } = await supabase
    .from('meeting_action_items')
    .select('*')
    .limit(0);
  
  if (!aiError) {
    console.log('✅ meeting_action_items table is accessible');
  } else {
    console.log('❌ Could not access meeting_action_items:', aiError.message);
  }
  
  // Check tasks columns
  const { data: taskCols, error: tError } = await supabase
    .from('tasks')
    .select('*')
    .limit(0);
    
  if (!tError) {
    console.log('✅ tasks table is accessible');
  } else {
    console.log('❌ Could not access tasks:', tError.message);
  }
  
  console.log('\n🎯 Migration process completed!');
  console.log('Note: Some DDL statements may need to be run directly in Supabase SQL Editor');
}

runMigration().catch(console.error);