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

async function mergeDiscoveryTypes() {
  console.log('🔍 Starting migration to merge Discovery Call and Discovery Meeting into Discovery...');

  try {
    // First, let's see how many records we need to update
    const { data: discoveryCallData, count: discoveryCallCount, error: callCountError } = await supabase
      .from('activities')
      .select('id', { count: 'exact' })
      .eq('type', 'meeting')
      .eq('details', 'Discovery Call');

    const { data: discoveryMeetingData, count: discoveryMeetingCount, error: meetingCountError } = await supabase
      .from('activities')
      .select('id', { count: 'exact' })
      .eq('type', 'meeting')
      .eq('details', 'Discovery Meeting');

    if (callCountError || meetingCountError) {
      console.error('Error counting records:', callCountError || meetingCountError);
      process.exit(1);
    }

    const totalToUpdate = (discoveryCallCount || 0) + (discoveryMeetingCount || 0);
    console.log(`📊 Found ${discoveryCallCount || 0} "Discovery Call" records`);
    console.log(`📊 Found ${discoveryMeetingCount || 0} "Discovery Meeting" records`);
    console.log(`📊 Total records to update: ${totalToUpdate}`);

    if (totalToUpdate === 0) {
      console.log('✅ No records need updating. Migration complete!');
      return;
    }

    // Update Discovery Call to Discovery
    if (discoveryCallCount > 0) {
      console.log('🔄 Updating "Discovery Call" records...');
      const { data: updatedCallData, count: updatedCallCount, error: updateCallError } = await supabase
        .from('activities')
        .update({ details: 'Discovery' }, { count: 'exact' })
        .eq('type', 'meeting')
        .eq('details', 'Discovery Call');

      if (updateCallError) {
        console.error('Error updating Discovery Call records:', updateCallError);
        process.exit(1);
      }
      console.log(`✅ Updated ${updatedCallCount || 0} "Discovery Call" records to "Discovery"`);
    }

    // Update Discovery Meeting to Discovery
    if (discoveryMeetingCount > 0) {
      console.log('🔄 Updating "Discovery Meeting" records...');
      const { data: updatedMeetingData, count: updatedMeetingCount, error: updateMeetingError } = await supabase
        .from('activities')
        .update({ details: 'Discovery' }, { count: 'exact' })
        .eq('type', 'meeting')
        .eq('details', 'Discovery Meeting');

      if (updateMeetingError) {
        console.error('Error updating Discovery Meeting records:', updateMeetingError);
        process.exit(1);
      }
      console.log(`✅ Updated ${updatedMeetingCount || 0} "Discovery Meeting" records to "Discovery"`);
    }

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    // Get counts for each type separately to avoid pagination issues
    const { count: discoveryCount, error: discoveryError } = await supabase
      .from('activities')
      .select('id', { count: 'exact' })
      .eq('type', 'meeting')
      .eq('details', 'Discovery');

    const { count: remainingCallCount, error: callError } = await supabase
      .from('activities')
      .select('id', { count: 'exact' })
      .eq('type', 'meeting')
      .eq('details', 'Discovery Call');

    const { count: remainingMeetingCount, error: meetingError } = await supabase
      .from('activities')
      .select('id', { count: 'exact' })
      .eq('type', 'meeting')
      .eq('details', 'Discovery Meeting');

    if (discoveryError || callError || meetingError) {
      console.error('Error verifying migration:', discoveryError || callError || meetingError);
      process.exit(1);
    }

    console.log('\n📊 Final meeting type distribution:');
    console.log(`   Discovery: ${discoveryCount || 0}`);
    if (remainingCallCount && remainingCallCount > 0) {
      console.log(`   Discovery Call: ${remainingCallCount} (remaining)`);
    }
    if (remainingMeetingCount && remainingMeetingCount > 0) {
      console.log(`   Discovery Meeting: ${remainingMeetingCount} (remaining)`);
    }

    if (remainingCallCount || remainingMeetingCount) {
      console.warn('⚠️  Warning: Some records may not have been updated');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log(`   All discovery-related meetings are now unified as "Discovery"`);
    }

  } catch (error) {
    console.error('Unexpected error during migration:', error);
    process.exit(1);
  }
}

// Add a safety check
async function confirmMigration() {
  console.log('\n⚠️  This script will merge "Discovery Call" and "Discovery Meeting" into "Discovery".');
  console.log('This action cannot be easily undone without a backup.');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Run the migration
confirmMigration()
  .then(() => mergeDiscoveryTypes())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  });