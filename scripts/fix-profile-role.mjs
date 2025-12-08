#!/usr/bin/env node
/**
 * Fix Profile Role - Update Andrew to Director
 */

import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const ANDREW_DEV_ID = 'bb6323fe-4e12-45f7-a607-6b9081639447';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function fixProfile() {
  console.log('=== CHECKING PROFILE SCHEMA ===\n');

  // Get current profile with all columns
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ANDREW_DEV_ID)
    .single();

  if (error) {
    console.log('Error fetching profile:', error.message);
    return;
  }

  console.log('Current profile columns and values:');
  for (const [key, value] of Object.entries(profile)) {
    console.log(`  ${key}: ${JSON.stringify(value)}`);
  }
  console.log();

  // Try to update role field
  console.log('=== UPDATING ROLE ===\n');

  // Check if role column exists
  if ('role' in profile) {
    console.log('Role column exists, current value:', profile.role);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'director' })
      .eq('id', ANDREW_DEV_ID);

    if (updateError) {
      console.log('Error updating role:', updateError.message);
    } else {
      console.log('Role updated to: director');
    }
  } else {
    console.log('Role column does not exist in profiles table');
  }

  // Check for job_title or similar
  if ('job_title' in profile) {
    console.log('\nJob title column exists, current value:', profile.job_title);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ job_title: 'Director' })
      .eq('id', ANDREW_DEV_ID);

    if (updateError) {
      console.log('Error updating job_title:', updateError.message);
    } else {
      console.log('Job title updated to: Director');
    }
  }

  // Ensure is_admin is true
  if ('is_admin' in profile) {
    const { error: adminError } = await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', ANDREW_DEV_ID);

    if (adminError) {
      console.log('Error setting is_admin:', adminError.message);
    } else {
      console.log('is_admin set to: true');
    }
  }

  // Verify update
  console.log('\n=== VERIFICATION ===\n');
  const { data: updatedProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', ANDREW_DEV_ID)
    .single();

  console.log('Updated profile:');
  const relevantFields = ['email', 'first_name', 'last_name', 'role', 'job_title', 'is_admin', 'title'];
  for (const field of relevantFields) {
    if (field in updatedProfile) {
      console.log(`  ${field}: ${JSON.stringify(updatedProfile[field])}`);
    }
  }

  // Check meetings again
  console.log('\n=== MEETINGS CHECK ===\n');
  const { count: totalMeetings } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true });

  const { count: andrewMeetings } = await supabase
    .from('meetings')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ANDREW_DEV_ID);

  console.log('Total meetings:', totalMeetings);
  console.log('Andrew owns:', andrewMeetings);

  if (totalMeetings > andrewMeetings) {
    console.log('Missing meetings:', totalMeetings - andrewMeetings);

    // Find who owns the rest
    const { data: otherMeetings } = await supabase
      .from('meetings')
      .select('owner_user_id')
      .neq('owner_user_id', ANDREW_DEV_ID)
      .limit(1000);

    const owners = {};
    if (otherMeetings) {
      otherMeetings.forEach(m => {
        const o = m.owner_user_id || 'NULL';
        owners[o] = (owners[o] || 0) + 1;
      });
    }
    console.log('\nOther meeting owners:');
    for (const [uid, count] of Object.entries(owners)) {
      // Check if this is a known profile
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', uid)
        .single();

      const email = ownerProfile ? ownerProfile.email : 'UNKNOWN/ORPHAN';
      console.log(`  ${uid}: ${count} meetings (${email})`);
    }
  }

  console.log('\n✅ Done!');
}

fixProfile().catch(console.error);
