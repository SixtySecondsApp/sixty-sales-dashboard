#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Old Neon database connection
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function migrateSpecificContactNames() {
  try {
    console.log('🔄 Starting targeted contact names migration...\n');
    
    await neonClient.connect();

    // Step 1: Get contacts WITHOUT names from Supabase
    console.log('📊 Step 1: Finding contacts without names in Supabase');
    const { data: contactsWithoutNames, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email')
      .or('first_name.is.null,last_name.is.null')
      .order('email');

    if (fetchError) throw fetchError;

    console.log(`Found ${contactsWithoutNames.length} contacts without names in Supabase\n`);

    // Step 2: For each contact, try to find their name in Neon
    console.log('🔄 Step 2: Looking up names in Neon database\n');
    
    let updatedCount = 0;
    let notFoundCount = 0;

    for (const contact of contactsWithoutNames) {
      // First try contacts table
      const neonContact = await neonClient.query(`
        SELECT first_name, last_name, full_name
        FROM contacts
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1;
      `, [contact.email]);

      if (neonContact.rows.length > 0 && (neonContact.rows[0].first_name || neonContact.rows[0].last_name)) {
        // Update in Supabase
        const updateData = {};
        if (neonContact.rows[0].first_name) updateData.first_name = neonContact.rows[0].first_name;
        if (neonContact.rows[0].last_name) updateData.last_name = neonContact.rows[0].last_name;

        const { error } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contact.id);

        if (!error) {
          console.log(`✅ Updated: ${contact.email} → ${neonContact.rows[0].first_name} ${neonContact.rows[0].last_name || ''}`);
          updatedCount++;
        }
      } else {
        // Try deals table
        const neonDeal = await neonClient.query(`
          SELECT DISTINCT contact_name
          FROM deals
          WHERE LOWER(contact_email) = LOWER($1)
            AND contact_name IS NOT NULL
            AND contact_name != ''
          LIMIT 1;
        `, [contact.email]);

        if (neonDeal.rows.length > 0) {
          // Parse name
          const nameParts = neonDeal.rows[0].contact_name.trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          const { error } = await supabase
            .from('contacts')
            .update({
              first_name: firstName,
              last_name: lastName
            })
            .eq('id', contact.id);

          if (!error) {
            console.log(`✅ Updated from deals: ${contact.email} → ${neonDeal.rows[0].contact_name}`);
            updatedCount++;
          }
        } else {
          notFoundCount++;
        }
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Contacts without names: ${contactsWithoutNames.length}`);
    console.log(`   Successfully updated: ${updatedCount}`);
    console.log(`   Not found in Neon: ${notFoundCount}`);

    // Step 3: Handle is_primary flag
    console.log('\n🔄 Step 3: Migrating is_primary flags from Neon\n');
    
    // Get all primary contacts from Neon
    const primaryContacts = await neonClient.query(`
      SELECT email, is_primary
      FROM contacts
      WHERE is_primary = true
        AND email IS NOT NULL;
    `);

    console.log(`Found ${primaryContacts.rows.length} primary contacts in Neon`);

    let primaryUpdated = 0;
    for (const neonPrimary of primaryContacts.rows) {
      const { error } = await supabase
        .from('contacts')
        .update({ is_primary: true })
        .eq('email', neonPrimary.email);

      if (!error) {
        primaryUpdated++;
      }
    }

    console.log(`Updated ${primaryUpdated} contacts as primary`);

    // Final verification
    console.log('\n📊 Final verification:');
    const { count: totalCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    const { count: namedCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .not('first_name', 'is', null);

    const { count: primaryCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('is_primary', true);

    console.log(`   Total contacts: ${totalCount}`);
    console.log(`   Contacts with names: ${namedCount}`);
    console.log(`   Primary contacts: ${primaryCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await neonClient.end();
    console.log('\n🔌 Database connections closed');
  }
}

// Run the migration
migrateSpecificContactNames().catch(console.error);