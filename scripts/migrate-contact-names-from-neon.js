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

async function migrateContactNames() {
  try {
    await neonClient.connect();

    // Step 1: Get all contacts with names from Neon
    const neonContacts = await neonClient.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        full_name,
        phone
      FROM contacts
      WHERE (first_name IS NOT NULL AND first_name != '') 
        OR (last_name IS NOT NULL AND last_name != '')
        OR (full_name IS NOT NULL AND full_name != '')
      ORDER BY email;
    `);
    // Step 2: Get all contacts from Supabase to match by email
    const { data: supabaseContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .order('email');

    if (fetchError) {
      throw fetchError;
    }
    // Create email to Supabase contact mapping
    const supabaseContactMap = new Map();
    supabaseContacts.forEach(contact => {
      if (contact.email) {
        supabaseContactMap.set(contact.email.toLowerCase(), contact);
      }
    });

    // Step 3: Update Supabase contacts with Neon names
    let updatedCount = 0;
    let skippedCount = 0;
    const updatePromises = [];

    for (const neonContact of neonContacts.rows) {
      const supabaseContact = supabaseContactMap.get(neonContact.email.toLowerCase());
      
      if (supabaseContact) {
        // Check if Supabase contact needs updating
        if (!supabaseContact.first_name && !supabaseContact.last_name) {
          const updateData = {};
          
          if (neonContact.first_name) updateData.first_name = neonContact.first_name;
          if (neonContact.last_name) updateData.last_name = neonContact.last_name;
          if (neonContact.phone) updateData.phone = neonContact.phone;
          
          updatePromises.push(
            supabase
              .from('contacts')
              .update(updateData)
              .eq('id', supabaseContact.id)
              .then(() => {
                updatedCount++;
              })
              .catch(error => {
              })
          );
        } else {
          skippedCount++;
        }
      }
    }

    // Execute all updates
    await Promise.all(updatePromises);
    // Step 4: Handle contacts from deals table (like the original script)
    const neonDeals = await neonClient.query(`
      SELECT DISTINCT
        contact_email,
        contact_name
      FROM deals
      WHERE contact_name IS NOT NULL 
        AND contact_name != ''
        AND contact_email IS NOT NULL
        AND contact_email != '';
    `);
    let dealUpdatedCount = 0;
    for (const deal of neonDeals.rows) {
      const supabaseContact = supabaseContactMap.get(deal.contact_email.toLowerCase());
      
      if (supabaseContact && !supabaseContact.first_name && !supabaseContact.last_name) {
        // Parse the name into first and last name
        const nameParts = deal.contact_name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        const { error } = await supabase
          .from('contacts')
          .update({
            first_name: firstName,
            last_name: lastName
          })
          .eq('id', supabaseContact.id);

        if (!error) {
          dealUpdatedCount++;
        }
      }
    }
    // Final verification
    const { data: finalStats, error: statsError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .not('first_name', 'is', null)
      .not('last_name', 'is', null);

    if (!statsError) {
    }

  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

// Run the migration
migrateContactNames().catch(console.error);