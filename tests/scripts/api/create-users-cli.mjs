import { createClient } from '@supabase/supabase-js';

// Development-v2 with service role key
const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔐 Creating auth users from profiles...\n');

// Step 1: Get all profiles
console.log('📥 Fetching profiles...');
const { data: profiles, error: profileError } = await supabase
  .from('profiles')
  .select('id, email')
  .order('email');

if (profileError) {
  console.error('❌ Error fetching profiles:', profileError);
  process.exit(1);
}

console.log(`✅ Found ${profiles.length} profiles\n`);

// Step 2: Get existing auth users
console.log('📥 Checking existing auth users...');
const { data: { users: existingUsers }, error: usersError } = await supabase.auth.admin.listUsers();

if (usersError) {
  console.error('❌ Error listing users:', usersError);
  process.exit(1);
}

const existingEmails = new Set(existingUsers.map(u => u.email));
console.log(`ℹ️  Already have ${existingUsers.length} auth users\n`);

// Step 3: For each profile WITHOUT an auth user, delete the profile temporarily and create via admin API
let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const profile of profiles) {
  if (existingEmails.has(profile.email)) {
    console.log(`⏭️  Skipping ${profile.email} - already has auth user`);
    skipCount++;
    continue;
  }

  console.log(`\n🔄 Processing: ${profile.email}`);
  console.log(`   Profile ID: ${profile.id}`);

  try {
    // Delete the profile temporarily
    console.log('   1. Deleting profile temporarily...');
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profile.id);

    if (deleteError) {
      console.error(`   ❌ Delete failed:`, deleteError.message);
      errorCount++;
      continue;
    }

    // Create user via admin API (this will auto-create profile with trigger)
    console.log('   2. Creating auth user...');
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: profile.email,
      email_confirm: true,
      password: 'TempPassword123!',
      user_metadata: { email: profile.email }
    });

    if (createError) {
      console.error(`   ❌ Create failed:`, createError.message);

      // Restore the profile
      console.log('   3. Restoring profile...');
      await supabase
        .from('profiles')
        .insert([{ id: profile.id, email: profile.email }]);

      errorCount++;
      continue;
    }

    console.log(`   ✅ Created! New ID: ${userData.user.id.substring(0, 8)}...`);

    // Check if the IDs match
    if (userData.user.id === profile.id) {
      console.log(`   ✅ IDs MATCH! Perfect!`);
      successCount++;
    } else {
      console.log(`   ⚠️  ID MISMATCH!`);
      console.log(`      Original: ${profile.id}`);
      console.log(`      New:      ${userData.user.id}`);
      console.log(`   ⚠️  This will break data relationships!`);
      errorCount++;
    }

  } catch (error) {
    console.error(`   ❌ Unexpected error:`, error.message);
    errorCount++;
  }
}

console.log('\n================================================');
console.log('SUMMARY:');
console.log(`   ✅ Success: ${successCount}`);
console.log(`   ⏭️  Skipped: ${skipCount}`);
console.log(`   ❌ Errors: ${errorCount}`);
console.log('================================================\n');

// Final verification
const { data: { users: finalUsers } } = await supabase.auth.admin.listUsers();
console.log(`✅ Total auth users now: ${finalUsers.length}`);
console.log(`✅ Total profiles: ${profiles.length}`);

if (finalUsers.length === profiles.length) {
  console.log('\n🎉 SUCCESS! All profiles have auth users!');
  console.log('Users can now log in with password: TempPassword123!\n');
} else {
  console.log('\n⚠️  Some profiles still missing auth users.');
  console.log('Please check the errors above.\n');
}
