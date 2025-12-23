import { createClient } from '@supabase/supabase-js';

const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🚀 Calling create-users-from-profiles Edge Function...\n');

try {
  const { data, error } = await devSupabase.functions.invoke('create-users-from-profiles', {
    body: {}
  });

  if (error) {
    console.error('❌ Error calling function:', error);
    process.exit(1);
  }

  console.log('✅ Function completed successfully!\n');
  console.log('📊 Results:');
  console.log(JSON.stringify(data, null, 2));

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}
