import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function rollbackDiscoveryMerge() {
  console.log('⚠️  WARNING: This rollback script requires manual intervention.');
  console.log('Since we merged both "Discovery Call" and "Discovery Meeting" into "Discovery",');
  console.log('we cannot automatically determine which records were originally which type.');
  console.log('\nYou have several options:');
  console.log('1. Restore from a database backup taken before the migration');
  console.log('2. Use the activities_backup_20250701 table if you created it');
  console.log('3. Manually update records based on other criteria (date ranges, users, etc.)');
  console.log('\nExample queries you might use:');
  console.log('\n-- If you have a backup table:');
  console.log('UPDATE activities a');
  console.log('SET details = b.details');
  console.log('FROM activities_backup_20250701 b');
  console.log('WHERE a.id = b.id;');
  console.log('\n-- Or based on patterns (customize as needed):');
  console.log('-- For example, if certain users used "Discovery Call":');
  console.log("UPDATE activities SET details = 'Discovery Call'");
  console.log("WHERE type = 'meeting' AND details = 'Discovery'");
  console.log("AND user_id IN (/* list of user IDs */);");
  console.log('\n-- Or based on date ranges:');
  console.log("UPDATE activities SET details = 'Discovery Meeting'");
  console.log("WHERE type = 'meeting' AND details = 'Discovery'");
  console.log("AND created_at < '2024-06-01';");
  
  // Show current Discovery count for reference
  const { data: discoveryData, count: discoveryCount, error } = await supabase
    .from('activities')
    .select('id', { count: 'exact' })
    .eq('type', 'meeting')
    .eq('details', 'Discovery');

  if (!error && discoveryCount !== null) {
    console.log(`\n📊 Current "Discovery" records that would need to be split: ${discoveryCount}`);
  }
}

rollbackDiscoveryMerge()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });