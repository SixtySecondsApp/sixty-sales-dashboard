import { createClient } from '@supabase/supabase-js';

const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

console.log('🔄 Triggering PostgREST schema cache reload...\n');

// Try using the NOTIFY command which PostgREST listens to
try {
  console.log('📡 Sending NOTIFY pgrst to trigger schema reload...');

  // PostgREST listens for NOTIFY pgrst to reload schema
  const { error } = await devSupabase.rpc('exec_sql', {
    query: "NOTIFY pgrst, 'reload schema'"
  });

  if (error) {
    console.log(`   ⚠️  exec_sql method failed: ${error.message}`);
    console.log('   Trying alternative method...\n');

    // Try making a harmless DDL change
    const { error: ddlError } = await devSupabase.rpc('exec_sql', {
      query: "COMMENT ON TABLE profiles IS 'User profiles table - cache reload'"
    });

    if (ddlError) {
      console.log(`   ⚠️  DDL method also failed: ${ddlError.message}`);
      console.log('\n💡 The schema cache may need manual refresh from Supabase Dashboard.');
      console.log('   Go to: Settings → API → Click "Reload schema" button\n');
    } else {
      console.log('   ✅ DDL change applied - this should trigger cache reload');
    }
  } else {
    console.log('   ✅ NOTIFY command sent successfully');
  }

  console.log('\n⏳ Waiting 10 seconds for PostgREST to reload...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n🧪 Testing if tables are now accessible...\n');

  // Test if we can now query profiles
  const { data, error: queryError } = await devSupabase
    .from('profiles')
    .select('id')
    .limit(1);

  if (queryError) {
    console.log(`❌ Still getting error: ${queryError.message}`);
    console.log('\n📋 Troubleshooting steps:');
    console.log('1. Go to Supabase Dashboard → development-v2');
    console.log('2. Settings → API');
    console.log('3. Click "Reload schema" button');
    console.log('4. Wait 30 seconds');
    console.log('5. Run: node sync-data-via-api.mjs');
  } else {
    console.log('✅ Tables are now accessible!');
    console.log(`   Found ${data?.length || 0} profiles`);
    console.log('\n🚀 Ready to sync data! Run: node sync-data-via-api.mjs');
  }

} catch (err) {
  console.log(`❌ Error: ${err.message}`);
}
