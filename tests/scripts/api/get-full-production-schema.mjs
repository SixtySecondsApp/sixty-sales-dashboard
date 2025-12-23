import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs'
);

console.log('🔍 Getting complete production schema...\n');

// Get all columns for all tables
const { data: columns, error: colError } = await prodSupabase.rpc('exec_sql', {
  query: `
    SELECT
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name IN (
      'profiles', 'organizations', 'contacts', 'deals',
      'activities', 'tasks', 'meetings', 'communication_events',
      'workflow_definitions', 'workflow_executions', 'companies',
      'teams', 'team_members'
    )
    ORDER BY table_name, ordinal_position;
  `
});

if (colError) {
  console.error('❌ Error fetching schema:', colError);
  process.exit(1);
}

// Group columns by table
const tableSchemas = {};
for (const col of columns) {
  if (!tableSchemas[col.table_name]) {
    tableSchemas[col.table_name] = [];
  }
  tableSchemas[col.table_name].push(col);
}

// Generate ALTER TABLE statements for each table
let alterStatements = '-- Add Missing Columns to Development-v2\n';
alterStatements += '-- Generated from production schema\n\n';

for (const [tableName, cols] of Object.entries(tableSchemas)) {
  alterStatements += `-- ${tableName}\n`;

  for (const col of cols) {
    let dataType = col.data_type;

    // Handle special types
    if (col.udt_name === 'uuid') dataType = 'UUID';
    else if (col.udt_name === 'timestamptz') dataType = 'TIMESTAMPTZ';
    else if (col.udt_name === 'jsonb') dataType = 'JSONB';
    else if (col.data_type === 'character varying') {
      dataType = col.character_maximum_length
        ? `VARCHAR(${col.character_maximum_length})`
        : 'TEXT';
    } else if (col.data_type === 'USER-DEFINED') {
      // It's likely an ENUM, we'll just use TEXT for now
      dataType = 'TEXT';
    }

    let nullable = col.is_nullable === 'YES' ? '' : 'NOT NULL';
    let defaultVal = '';

    if (col.column_default) {
      // Skip complex defaults like function calls for ALTER TABLE
      if (!col.column_default.includes('(')) {
        defaultVal = `DEFAULT ${col.column_default}`;
      }
    }

    alterStatements += `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${col.column_name} ${dataType} ${nullable} ${defaultVal};\n`;
  }

  alterStatements += '\n';
}

// Write to file
writeFileSync('add-all-missing-columns.sql', alterStatements);

console.log('✅ Schema exported to: add-all-missing-columns.sql');
console.log(`\n📊 Found ${Object.keys(tableSchemas).length} tables with ${columns.length} total columns`);
console.log('\n📋 Tables processed:');
for (const [table, cols] of Object.entries(tableSchemas)) {
  console.log(`   - ${table}: ${cols.length} columns`);
}

console.log('\n🚀 Next steps:');
console.log('   1. Run this SQL in Supabase dashboard');
console.log('   2. Run: node sync-data-via-api.mjs');
