#!/usr/bin/env node
/**
 * Fix Profile Stage - Update Andrew from Trainee to Director
 */

import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const ANDREW_DEV_ID = 'bb6323fe-4e12-45f7-a607-6b9081639447';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function fixStage() {
  console.log('=== FIXING PROFILE STAGE ===\n');

  // Update stage to Director
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ stage: 'Director' })
    .eq('id', ANDREW_DEV_ID);

  if (updateError) {
    console.log('Error updating stage:', updateError.message);
  } else {
    console.log('Stage updated to: Director');
  }

  // Verify
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, first_name, last_name, stage, is_admin')
    .eq('id', ANDREW_DEV_ID)
    .single();

  console.log('\nUpdated profile:');
  console.log('  Email:', profile?.email);
  console.log('  Name:', profile?.first_name, profile?.last_name);
  console.log('  Stage:', profile?.stage);
  console.log('  Is Admin:', profile?.is_admin);

  console.log('\n✅ Done! Refresh the app.');
}

fixStage().catch(console.error);
