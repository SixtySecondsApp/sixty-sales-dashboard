import { createClient } from '@supabase/supabase-js';

// Production (main branch)
const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTQ0MTI4OCwiZXhwIjoyMDQ3MDE3Mjg4fQ.wqULbhfOz7f7kKlbjXnwBLfBSx8zl-SnW5gMTrUTW28'
);

// Development-v2
const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔐 Copying auth users from production to development-v2...\n');

try {
  // Step 1: Get all auth users from production
  console.log('📥 Fetching production auth users...');
  const { data: { users: prodUsers }, error: prodError } = await prodSupabase.auth.admin.listUsers();

  if (prodError) {
    console.error('❌ Error fetching production users:', prodError);
    process.exit(1);
  }

  console.log(`✅ Found ${prodUsers.length} users in production\n`);

  // Step 2: Delete all NEW auth users from development-v2 (keep profiles)
  console.log('🗑️  Removing newly created dev auth users...');
  const { data: { users: devUsers }, error: devError } = await devSupabase.auth.admin.listUsers();

  if (devError) {
    console.error('❌ Error fetching dev users:', devError);
    process.exit(1);
  }

  console.log(`Found ${devUsers.length} existing dev users`);

  for (const devUser of devUsers) {
    console.log(`   Deleting: ${devUser.email}`);
    await devSupabase.auth.admin.deleteUser(devUser.id);
  }

  console.log(`✅ Cleaned up ${devUsers.length} dev users\n`);

  // Step 3: Create all production users in development-v2
  console.log('📤 Creating production users in development-v2...');
  let successCount = 0;
  let errorCount = 0;

  for (const user of prodUsers) {
    try {
      console.log(`\n   Creating: ${user.email}`);

      // Create user with same ID and email
      const { data, error } = await devSupabase.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        password: 'TempPassword123!',
        user_metadata: user.user_metadata || {},
      });

      if (error) {
        console.error(`   ❌ Failed:`, error.message);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Created with ID: ${data.user.id}`);

      // Check if IDs match
      if (data.user.id === user.id) {
        console.log(`   🎯 ID MATCH! Perfect!`);
      } else {
        console.log(`   ⚠️  ID MISMATCH!`);
        console.log(`      Production: ${user.id}`);
        console.log(`      Dev:        ${data.user.id}`);
      }

      successCount++;

    } catch (error) {
      console.error(`   ❌ Unexpected error:`, error.message);
      errorCount++;
    }
  }

  console.log('\n================================================');
  console.log('SUMMARY:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('================================================\n');

  console.log('⚠️  NOTE: Auth API cannot preserve user IDs.');
  console.log('You will still need to run the remapping script.');
  console.log('\nBetter approach: Use pg_dump/pg_restore to copy auth schema.\n');

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}
