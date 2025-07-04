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
    console.log('🔄 Starting contact names migration from Neon to Supabase...\n');
    
    await neonClient.connect();

    // Step 1: Get all contacts with names from Neon
    console.log('📊 Step 1: Fetching contacts with names from Neon database');
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
    
    console.log(`Found ${neonContacts.rows.length} contacts with names in Neon database\n`);

    // Step 2: Get all contacts from Supabase to match by email
    console.log('📊 Step 2: Fetching contacts from Supabase');
    const { data: supabaseContacts, error: fetchError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name')
      .order('email');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${supabaseContacts.length} contacts in Supabase\n`);

    // Create email to Supabase contact mapping
    const supabaseContactMap = new Map();
    supabaseContacts.forEach(contact => {
      if (contact.email) {
        supabaseContactMap.set(contact.email.toLowerCase(), contact);
      }
    });

    // Step 3: Update Supabase contacts with Neon names
    console.log('🔄 Step 3: Updating Supabase contacts with names from Neon\n');
    
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
                console.log(`✅ Updated: ${neonContact.email} - ${neonContact.first_name} ${neonContact.last_name || ''}`);
                updatedCount++;
              })
              .catch(error => {
                console.log(`❌ Failed to update ${neonContact.email}: ${error.message}`);
              })
          );
        } else {
          skippedCount++;
        }
      }
    }

    // Execute all updates
    await Promise.all(updatePromises);

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total Neon contacts with names: ${neonContacts.rows.length}`);
    console.log(`   Successfully updated: ${updatedCount}`);
    console.log(`   Skipped (already have names): ${skippedCount}`);

    // Step 4: Handle contacts from deals table (like the original script)
    console.log('\n📋 Step 4: Extract names from deals table for remaining contacts');
    
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

    console.log(`Found ${neonDeals.rows.length} unique contact names in deals table`);

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
          console.log(`✅ Updated from deals: ${deal.contact_email} → ${deal.contact_name}`);
          dealUpdatedCount++;
        }
      }
    }

    console.log(`\n🎉 Updated ${dealUpdatedCount} additional contacts from deals data!`);

    // Final verification
    console.log('\n📊 Final verification - Supabase contact names:');
    const { data: finalStats, error: statsError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .not('first_name', 'is', null)
      .not('last_name', 'is', null);

    if (!statsError) {
      console.log(`   Total contacts with names: ${finalStats.length}`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await neonClient.end();
    console.log('\n🔌 Database connections closed');
  }
}

// Run the migration
migrateContactNames().catch(console.error);