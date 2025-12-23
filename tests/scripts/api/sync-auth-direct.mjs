import { createClient } from '@supabase/supabase-js';

// Production (source) - using service_role key to access auth schema
const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs',
  {
    db: { schema: 'auth' } // Access auth schema
  }
);

// Development-v2 (destination)
const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc',
  {
    db: { schema: 'auth' }
  }
);

console.log('🔐 Attempting direct auth.users sync...\n');

try {
  // Try to read from auth.users using service role
  console.log('📥 Attempting to fetch users from production auth.users...');
  const { data: prodUsers, error: fetchError } = await prodSupabase
    .from('users')
    .select('*')
    .limit(5);

  if (fetchError) {
    console.log('❌ Cannot access auth.users via REST API');
    console.log('   Error:', fetchError.message);
    console.log('\n💡 The auth schema is protected and cannot be queried via REST API.');
    console.log('   We need to use a different approach...\n');

    // Alternative: Use the profiles we already have to determine which users to create
    console.log('📋 Alternative approach: Create users based on existing profiles');
    console.log('   1. We already synced profiles (20 records)');
    console.log('   2. We can create auth.users with temporary passwords');
    console.log('   3. Users will need to reset their passwords\n');

    // Get profiles from dev
    const { data: profiles, error: profileError } = await devSupabase
      .from('profiles')
      .select('id, email, full_name')
      .limit(20);

    if (!profileError && profiles) {
      console.log(`✅ Found ${profiles.length} profiles in development-v2`);
      console.log('\n   Sample profiles:');
      profiles.slice(0, 5).forEach(p => {
        console.log(`   - ${p.email} (ID: ${p.id.substring(0, 8)}...)`);
      });

      console.log('\n📝 Next step: We need to disable the profile creation trigger first');
      console.log('   Then insert users directly into auth.users with these IDs\n');
    }

  } else {
    console.log('✅ Successfully fetched users:', prodUsers?.length || 0);
    console.log(prodUsers);
  }

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
}
