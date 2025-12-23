import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs'
);

console.log('🔍 Fetching ALL columns from production by examining actual data...\n');

const tables = [
  'profiles',
  'organizations',
  'contacts',
  'deals',
  'activities',
  'meetings',
  'communication_events',
  'workflow_executions'
];

const allColumns = {};

for (const table of tables) {
  console.log(`📦 Fetching sample from ${table}...`);

  const { data, error } = await prodSupabase
    .from(table)
    .select('*')
    .limit(1);

  if (error) {
    console.log(`   ❌ ${error.message}`);
    continue;
  }

  if (!data || data.length === 0) {
    console.log(`   ℹ️  Empty table`);
    allColumns[table] = [];
    continue;
  }

  const columns = Object.keys(data[0]);
  allColumns[table] = columns;
  console.log(`   ✅ ${columns.length} columns: ${columns.join(', ')}`);
}

// Generate comprehensive ALTER TABLE statements
let sql = '-- Complete Column Addition Script\n';
sql += '-- Generated from actual production data\n\n';

// Map of column name patterns to data types
const typeGuess = (colName) => {
  if (colName.endsWith('_at')) return 'TIMESTAMPTZ';
  if (colName.endsWith('_id')) return 'UUID';
  if (colName.endsWith('_date')) return 'DATE';
  if (colName.includes('is_') || colName.includes('has_')) return 'BOOLEAN';
  if (colName.includes('count') || colName.includes('order') || colName.includes('level')) return 'INTEGER';
  if (colName.includes('_data') || colName.includes('_config') || colName.includes('_metadata') || colName.includes('_items') || colName.includes('_type')) return 'JSONB';
  if (colName.includes('amount') || colName.includes('value') || colName.includes('revenue')) return 'NUMERIC';
  return 'TEXT';
};

for (const [table, columns] of Object.entries(allColumns)) {
  if (columns.length === 0) continue;

  sql += `-- ${table} (${columns.length} columns)\n`;

  for (const col of columns) {
    const dataType = typeGuess(col);
    sql += `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${dataType};\n`;
  }

  sql += '\n';
}

writeFileSync('add-all-production-columns.sql', sql);

console.log('\n✅ SQL generated: add-all-production-columns.sql');
console.log('\n📊 Summary:');
for (const [table, columns] of Object.entries(allColumns)) {
  console.log(`   ${table}: ${columns.length} columns`);
}
