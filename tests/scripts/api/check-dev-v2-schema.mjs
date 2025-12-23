import { createClient } from '@supabase/supabase-js';

const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔍 Checking if tables exist in development-v2...\n');

const tables = [
  'profiles',
  'organizations',
  'contacts',
  'deals',
  'activities',
  'meetings'
];

for (const table of tables) {
  try {
    // Try to select 1 row to see if table exists
    const { data, error } = await devSupabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: Table exists (can query it)`);
    }
  } catch (err) {
    console.log(`❌ ${table}: ${err.message}`);
  }
}

console.log('\n✅ Schema check complete');
