#!/usr/bin/env tsx
/**
 * Update a meeting's Fathom recording ID
 * 
 * Usage:
 *   tsx scripts/update-meeting-recording-id.ts <meeting-id> <recording-id>
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

async function updateRecordingId(meetingId: string, newRecordingId: string) {
  console.log(`\n🔄 Updating meeting ${meetingId} with recording ID: ${newRecordingId}\n`);

  // Get current meeting
  const { data: meeting, error: getError } = await supabase
    .from('meetings')
    .select('id, title, fathom_recording_id')
    .eq('id', meetingId)
    .single();

  if (getError || !meeting) {
    console.error('❌ Meeting not found:', getError?.message);
    process.exit(1);
  }

  console.log('📋 Current meeting:');
  console.log(`   Title: ${meeting.title}`);
  console.log(`   Current Recording ID: ${meeting.fathom_recording_id}`);
  console.log(`   New Recording ID: ${newRecordingId}`);

  // Update the recording ID
  const { error: updateError } = await supabase
    .from('meetings')
    .update({
      fathom_recording_id: newRecordingId,
      transcript_fetch_attempts: 0, // Reset attempts so it will retry
      last_transcript_fetch_at: null, // Reset last fetch time
      updated_at: new Date().toISOString(),
    })
    .eq('id', meetingId);

  if (updateError) {
    console.error('❌ Failed to update:', updateError.message);
    process.exit(1);
  }

  console.log('\n✅ Meeting updated successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Run the backfill-transcripts function to fetch the transcript');
  console.log('   2. Or wait for the next sync to automatically fetch it');
}

const meetingId = process.argv[2];
const recordingId = process.argv[3];

if (!meetingId || !recordingId) {
  console.error('Usage: tsx scripts/update-meeting-recording-id.ts <meeting-id> <recording-id>');
  console.error('\nExample:');
  console.error('  tsx scripts/update-meeting-recording-id.ts 05891abb-319f-4117-bdca-d26f7db8a35c 12345678');
  process.exit(1);
}

updateRecordingId(meetingId, recordingId).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});


