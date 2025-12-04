import { createClient } from '@supabase/supabase-js';

// Development-v2 with service role key
const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

// Get the email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: node reset-user-password.mjs <email>');
  process.exit(1);
}

console.log(`\n🔐 Resetting password for: ${email}\n`);

try {
  // Find the user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing users:', listError);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\nAvailable users:');
    users.forEach(u => console.log(`  - ${u.email}`));
    process.exit(1);
  }

  console.log(`Found user: ${user.email}`);
  console.log(`User ID: ${user.id}`);

  // Reset password to simple one
  const newPassword = 'password123';
  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  }

  console.log(`\n✅ Password reset successfully!`);
  console.log(`\nLogin credentials:`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${newPassword}`);
  console.log(`\n💡 You can now log in with these credentials.\n`);

} catch (error) {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
}
