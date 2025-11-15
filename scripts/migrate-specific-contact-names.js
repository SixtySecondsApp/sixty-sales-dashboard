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
    await neonClient.connect();

    // Step 1: Get contacts WITHOUT names from Supabase
    const { data: contactsWithoutNames, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email')
      .or('first_name.is.null,last_name.is.null')
      .order('email');

    if (fetchError) throw fetchError;
    // Step 2: For each contact, try to find their name in Neon
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
            updatedCount++;
          }
        } else {
          notFoundCount++;
        }
      }
    }
    // Step 3: Handle is_primary flag
    // Get all primary contacts from Neon
    const primaryContacts = await neonClient.query(`
      SELECT email, is_primary
      FROM contacts
      WHERE is_primary = true
        AND email IS NOT NULL;
    `);
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
    // Final verification
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
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

// Run the migration
migrateSpecificContactNames().catch(console.error);