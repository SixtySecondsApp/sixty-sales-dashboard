import { createClient } from '@supabase/supabase-js';

// Production (source)
const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs'
);

// Development-v2 (destination)
const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔐 Syncing auth.users from Production to Development-v2...\n');

// Get all users from production
console.log('📥 Fetching users from production...');
const { data: { users: prodUsers }, error: fetchError } = await prodSupabase.auth.admin.listUsers();

if (fetchError) {
  console.error('❌ Error fetching users:', fetchError);
  process.exit(1);
}

console.log(`✅ Found ${prodUsers.length} users in production\n`);

// Create each user in development-v2
let successCount = 0;
let errorCount = 0;

for (const user of prodUsers) {
  console.log(`📦 Creating user: ${user.email}`);

  // Create user with admin API
  const { data, error } = await devSupabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true, // Auto-confirm email
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
    // Note: We can't copy the password hash, so we'll set a default password
    password: 'TempPassword123!', // Users will need to reset their password
  });

  if (error) {
    console.log(`   ❌ Error: ${error.message}`);
    console.log(`   ℹ️  Full error:`, JSON.stringify(error, null, 2));
    errorCount++;
  } else {
    console.log(`   ✅ Created successfully (ID: ${data.user.id})`);
    successCount++;
  }
}

console.log('\n📊 Summary:');
console.log(`   ✅ Successfully created: ${successCount} users`);
console.log(`   ❌ Errors: ${errorCount} users`);

console.log('\n⚠️  IMPORTANT: All users have been created with password: TempPassword123!');
console.log('   Users will need to reset their passwords on first login.\n');

// Verify users in development-v2
const { data: { users: devUsers }, error: verifyError } = await devSupabase.auth.admin.listUsers();

if (!verifyError) {
  console.log(`✅ Verification: ${devUsers.length} users now exist in development-v2\n`);
}

console.log('✅ Auth sync complete!');
