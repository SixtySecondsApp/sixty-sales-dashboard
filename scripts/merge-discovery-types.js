import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function mergeDiscoveryTypes() {
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
      process.exit(1);
    }

    const totalToUpdate = (discoveryCallCount || 0) + (discoveryMeetingCount || 0);
    if (totalToUpdate === 0) {
      return;
    }

    // Update Discovery Call to Discovery
    if (discoveryCallCount > 0) {
      const { data: updatedCallData, count: updatedCallCount, error: updateCallError } = await supabase
        .from('activities')
        .update({ details: 'Discovery' }, { count: 'exact' })
        .eq('type', 'meeting')
        .eq('details', 'Discovery Call');

      if (updateCallError) {
        process.exit(1);
      }
    }

    // Update Discovery Meeting to Discovery
    if (discoveryMeetingCount > 0) {
      const { data: updatedMeetingData, count: updatedMeetingCount, error: updateMeetingError } = await supabase
        .from('activities')
        .update({ details: 'Discovery' }, { count: 'exact' })
        .eq('type', 'meeting')
        .eq('details', 'Discovery Meeting');

      if (updateMeetingError) {
        process.exit(1);
      }
    }

    // Verify the migration
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
      process.exit(1);
    }
    if (remainingCallCount && remainingCallCount > 0) {
    }
    if (remainingMeetingCount && remainingMeetingCount > 0) {
    }

    if (remainingCallCount || remainingMeetingCount) {
    } else {
    }

  } catch (error) {
    process.exit(1);
  }
}

// Add a safety check
async function confirmMigration() {
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Run the migration
confirmMigration()
  .then(() => mergeDiscoveryTypes())
  .then(() => process.exit(0))
  .catch((e) => {
    process.exit(1);
  });