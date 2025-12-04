import { createClient } from '@supabase/supabase-js';

const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔍 Listing ALL tables in development-v2...\n');

// Use a raw SQL query to list all tables
const { data, error } = await devSupabase.rpc('exec_sql', {
  query: `
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `
});

if (error) {
  console.log('❌ Error:', error.message);
  console.log('\nTrying alternative method...\n');

  // Try listing known tables
  const knownTables = [
    'profiles', 'deals', 'contacts', 'meetings', 'activities', 'tasks',
    'organizations', 'audit_logs', 'calendar_events', 'leads',
    'internal_email_domains', 'communication_events'
  ];

  for (const table of knownTables) {
    const { data, error } = await devSupabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error) {
      console.log(`✅ ${table}: exists (${data !== null ? 'accessible' : 'inaccessible'})`);
    } else {
      console.log(`❌ ${table}: ${error.message}`);
    }
  }
} else {
  console.log('Tables found:');
  console.log(data);
}

console.log('\n✅ Table listing complete');
