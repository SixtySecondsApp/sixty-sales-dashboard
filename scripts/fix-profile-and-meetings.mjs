#!/usr/bin/env node
/**
 * Fix Profile Role and Meetings Ownership
 */

import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const ANDREW_DEV_ID = 'bb6323fe-4e12-45f7-a607-6b9081639447';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function diagnoseAndFix() {
  console.log('=== DIAGNOSIS ===\n');

  // 1. Check Andrew's profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ANDREW_DEV_ID)
    .single();

  console.log("Andrew's current profile:");
  if (profileError) {
    console.log('  Error:', profileError.message);
  } else {
    console.log('  ID:', profile.id);
    console.log('  Email:', profile.email);
    console.log('  Name:', profile.first_name, profile.last_name);
    console.log('  Role:', profile.role);
    console.log('  Is Admin:', profile.is_admin);
    console.log('  Position:', profile.position);
  }
  console.log();

  // 2. Check meetings ownership distribution
  console.log('Meetings ownership:');
  const { data: meetings } = await supabase
    .from('meetings')
    .select('owner_user_id')
    .limit(5000);

  const meetingOwners = {};
  if (meetings) {
    meetings.forEach(m => {
      const owner = m.owner_user_id || 'NULL';
      meetingOwners[owner] = (meetingOwners[owner] || 0) + 1;
    });
  }

  for (const [uid, count] of Object.entries(meetingOwners)) {
    const isAndrew = uid === ANDREW_DEV_ID ? ' <-- Andrew' : '';
    console.log(`  ${uid}: ${count} meetings${isAndrew}`);
  }
  console.log();

  // 3. Check total meetings count
  const { count: totalMeetings } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true });
  console.log('Total meetings in database:', totalMeetings);

  // 4. Check meetings Andrew can see (simulating RLS)
  const { count: andrewMeetings } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ANDREW_DEV_ID);
  console.log('Meetings owned by Andrew:', andrewMeetings);
  console.log();

  // === FIXES ===
  console.log('=== APPLYING FIXES ===\n');

  // Fix 1: Update Andrew's profile to Director role
  console.log('1. Updating profile role to Director...');
  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({
      role: 'director',
      is_admin: true,
      position: 'Director'
    })
    .eq('id', ANDREW_DEV_ID);

  if (updateProfileError) {
    console.log('   Error:', updateProfileError.message);
  } else {
    console.log('   Profile updated to Director with admin privileges');
  }

  // Fix 2: Find any remaining orphan meeting owner IDs and reassign
  console.log('\n2. Finding orphan meeting owners...');

  // Get all profile IDs
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id');
  const profileIds = allProfiles ? allProfiles.map(p => p.id) : [];

  // Find meetings with orphan owners
  const orphanOwners = Object.keys(meetingOwners).filter(
    uid => uid !== 'NULL' && !profileIds.includes(uid)
  );

  console.log('   Orphan owner IDs found:', orphanOwners.length);

  // Fix each orphan owner
  for (const orphanId of orphanOwners) {
    const { data, error } = await supabase
      .from('meetings')
      .update({ owner_user_id: ANDREW_DEV_ID })
      .eq('owner_user_id', orphanId)
      .select('id');

    if (error) {
      console.log(`   Error fixing ${orphanId}: ${error.message}`);
    } else {
      const count = data ? data.length : 0;
      if (count > 0) {
        console.log(`   Reassigned ${count} meetings from ${orphanId} to Andrew`);
      }
    }
  }

  // === VERIFICATION ===
  console.log('\n=== VERIFICATION ===\n');

  // Re-check profile
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('role, is_admin, position')
    .eq('id', ANDREW_DEV_ID)
    .single();

  console.log('Updated profile:');
  console.log('  Role:', updatedProfile?.role);
  console.log('  Is Admin:', updatedProfile?.is_admin);
  console.log('  Position:', updatedProfile?.position);

  // Re-check meetings
  const { count: finalMeetingCount } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ANDREW_DEV_ID);

  console.log('\nMeetings now owned by Andrew:', finalMeetingCount);

  console.log('\n✅ Done! Please refresh the app.');
}

diagnoseAndFix().catch(console.error);
