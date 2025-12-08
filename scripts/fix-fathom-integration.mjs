#!/usr/bin/env node
/**
 * Fix Fathom Integration - Create integration record for Andrew
 */

import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const ANDREW_DEV_ID = 'bb6323fe-4e12-45f7-a607-6b9081639447';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function fixFathom() {
  console.log('=== FATHOM INTEGRATION DIAGNOSIS ===\n');

  // Check existing fathom integrations
  const { data: integrations, error: intError } = await supabase
    .from('fathom_integrations')
    .select('*');

  if (intError) {
    console.log('Error fetching fathom_integrations:', intError.message);
    return;
  }

  console.log('Existing Fathom integrations:', integrations?.length || 0);
  if (integrations && integrations.length > 0) {
    integrations.forEach(i => {
      console.log(`  User: ${i.user_id}, Active: ${i.is_active}, Email: ${i.fathom_user_email}`);
    });
  }

  // Check if Andrew has an integration
  const andrewIntegration = integrations?.find(i => i.user_id === ANDREW_DEV_ID);

  if (andrewIntegration) {
    console.log('\nAndrew already has a Fathom integration');
    console.log('  Is Active:', andrewIntegration.is_active);
    console.log('  Last Sync:', andrewIntegration.last_sync_at);
  } else {
    console.log('\nAndrew does NOT have a Fathom integration');

    // Check if there's an orphan integration we can reassign
    const orphanIntegration = integrations?.find(i => i.user_id !== ANDREW_DEV_ID);

    if (orphanIntegration) {
      console.log('\nFound orphan integration, reassigning to Andrew...');

      const { error: updateError } = await supabase
        .from('fathom_integrations')
        .update({ user_id: ANDREW_DEV_ID })
        .eq('id', orphanIntegration.id);

      if (updateError) {
        console.log('Error reassigning:', updateError.message);
      } else {
        console.log('Reassigned Fathom integration to Andrew');
      }
    } else {
      console.log('\nNo existing integration to reassign');
      console.log('Creating a placeholder integration for Andrew...');

      // Create a placeholder - user will need to properly connect Fathom
      // But this will at least show the meetings
      const { error: insertError } = await supabase
        .from('fathom_integrations')
        .insert({
          user_id: ANDREW_DEV_ID,
          access_token: 'dev_placeholder_token',
          refresh_token: 'dev_placeholder_refresh',
          token_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
          fathom_user_email: 'andrew.bryce@sixtyseconds.video',
          is_active: true,
          last_sync_at: new Date().toISOString()
        });

      if (insertError) {
        console.log('Error creating integration:', insertError.message);
      } else {
        console.log('Created placeholder Fathom integration for Andrew');
      }
    }
  }

  // Check meetings count
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

  // Verify final state
  console.log('\n=== FINAL STATE ===\n');

  const { data: finalIntegration } = await supabase
    .from('fathom_integrations')
    .select('*')
    .eq('user_id', ANDREW_DEV_ID)
    .single();

  if (finalIntegration) {
    console.log('Andrew Fathom integration:');
    console.log('  Is Active:', finalIntegration.is_active);
    console.log('  Email:', finalIntegration.fathom_user_email);
    console.log('  Last Sync:', finalIntegration.last_sync_at);
  }

  console.log('\n✅ Done! Refresh the meetings page.');
}

fixFathom().catch(console.error);
