import { createClient } from '@supabase/supabase-js';

const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs'
);

console.log('🔍 Getting production table list...\n');

// Get list of tables from production
const { data: tables, error } = await prodSupabase
  .rpc('exec_sql', {
    query: `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
  });

if (error) {
  console.log('❌ Error getting tables:', error.message);
  console.log('\nTrying alternative method...\n');

  // Try to get table info from information_schema
  const { data: tableInfo, error: infoError } = await prodSupabase
    .rpc('exec_sql', {
      query: `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `
    });

  if (infoError) {
    console.log('❌ Also failed:', infoError.message);
    process.exit(1);
  }

  console.log('✅ Found tables via information_schema:');
  console.log(tableInfo);
} else {
  console.log('✅ Found tables:');
  console.log(tables);
}

console.log('\n📊 Production has tables. Now we need to copy the schema to development-v2.');
console.log('\n💡 Since migrations have dependency issues, the best approach is:');
console.log('   1. Use Supabase Dashboard to copy production schema');
console.log('   2. Or use pg_dump from a machine with IPv4 connectivity');
console.log('   3. Or manually create core tables via dashboard SQL Editor');
