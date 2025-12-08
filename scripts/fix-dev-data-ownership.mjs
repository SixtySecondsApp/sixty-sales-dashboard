#!/usr/bin/env node
/**
 * Fix Dev Data Ownership
 *
 * Reassigns all orphaned data to Andrew's dev user ID
 */

import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const ANDREW_DEV_ID = 'bb6323fe-4e12-45f7-a607-6b9081639447';

// Orphaned production user IDs that need to be reassigned
const ORPHAN_IDS = [
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Main orphan with most data
  '2b5c8ec1-3b51-4f10-9b53-26fe8dc0da0a',
  '757b1991-f242-4cda-9e46-581a101fc822'
];

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function fixOwnership() {
  console.log('🔧 Fixing data ownership in dev database...\n');
  console.log('Target user ID:', ANDREW_DEV_ID);
  console.log('Orphan IDs to reassign:', ORPHAN_IDS);
  console.log();

  // 1. Fix activities.user_id
  console.log('📋 Fixing activities...');
  for (const orphanId of ORPHAN_IDS) {
    const { data, error } = await supabase
      .from('activities')
      .update({ user_id: ANDREW_DEV_ID })
      .eq('user_id', orphanId)
      .select('id');

    if (error) {
      console.log(`   Error updating activities for ${orphanId}: ${error.message}`);
    } else {
      const count = data ? data.length : 0;
      if (count > 0) console.log(`   Updated ${count} activities from ${orphanId}`);
    }
  }

  // 2. Fix deals.owner_id
  console.log('💰 Fixing deals...');
  for (const orphanId of ORPHAN_IDS) {
    const { data, error } = await supabase
      .from('deals')
      .update({ owner_id: ANDREW_DEV_ID })
      .eq('owner_id', orphanId)
      .select('id');

    if (error) {
      console.log(`   Error updating deals for ${orphanId}: ${error.message}`);
    } else {
      const count = data ? data.length : 0;
      if (count > 0) console.log(`   Updated ${count} deals from ${orphanId}`);
    }
  }

  // 3. Fix meetings.owner_user_id
  console.log('📅 Fixing meetings...');
  for (const orphanId of ORPHAN_IDS) {
    const { data, error } = await supabase
      .from('meetings')
      .update({ owner_user_id: ANDREW_DEV_ID })
      .eq('owner_user_id', orphanId)
      .select('id');

    if (error) {
      console.log(`   Error updating meetings for ${orphanId}: ${error.message}`);
    } else {
      const count = data ? data.length : 0;
      if (count > 0) console.log(`   Updated ${count} meetings from ${orphanId}`);
    }
  }

  // 4. Fix contacts.owner_id
  console.log('👥 Fixing contacts...');
  for (const orphanId of ORPHAN_IDS) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ owner_id: ANDREW_DEV_ID })
      .eq('owner_id', orphanId)
      .select('id');

    if (error) {
      console.log(`   Error updating contacts for ${orphanId}: ${error.message}`);
    } else {
      const count = data ? data.length : 0;
      if (count > 0) console.log(`   Updated ${count} contacts from ${orphanId}`);
    }
  }

  // 5. Verify results
  console.log('\n=== VERIFICATION ===\n');

  const tables = [
    { name: 'activities', col: 'user_id' },
    { name: 'deals', col: 'owner_id' },
    { name: 'meetings', col: 'owner_user_id' },
    { name: 'contacts', col: 'owner_id' }
  ];

  for (const { name, col } of tables) {
    const { count, error } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true })
      .eq(col, ANDREW_DEV_ID);

    if (error) {
      console.log(`${name}: Error - ${error.message}`);
    } else {
      console.log(`${name}: ${count} records now owned by Andrew`);
    }
  }

  console.log('\n✅ Done! Refresh the app to see your data.');
}

fixOwnership().catch(console.error);
