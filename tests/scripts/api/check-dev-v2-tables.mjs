import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔍 Checking development-v2 tables and data...\n');

// Try direct table queries
const tables = ['profiles', 'deals', 'meetings', 'activities', 'contacts', 'tasks'];

for (const table of tables) {
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    const icon = count > 0 ? '✅' : '⚠️ ';
    console.log(`${icon} ${table}: ${count || 0} records`);
  }
}

// Check auth users
console.log('\n🔐 Checking auth.users...');
const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
if (userError) {
  console.log(`❌ auth.users: ${userError.message}`);
} else {
  console.log(`✅ auth.users: ${userData.users.length} users`);
}
