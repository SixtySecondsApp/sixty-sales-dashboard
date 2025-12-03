import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

async function checkWithServiceRole() {
  console.log('🔍 Checking with Service Role (bypasses RLS)\n');

  const tables = ['profiles', 'deals', 'activities', 'meetings', 'tasks', 'contacts'];

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${table}: ${count} records`);
      if (data && data.length > 0) {
        console.log(`   Sample: ${JSON.stringify(data[0]).substring(0, 100)}...`);
      }
    }
  }
}

checkWithServiceRole().catch(console.error);
