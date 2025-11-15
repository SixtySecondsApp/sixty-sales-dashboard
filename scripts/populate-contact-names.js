#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function populateContactNames() {
  try {
    await client.connect();

    // Check current state of contact names
    const nameStats = await client.query(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(full_name) as contacts_with_full_name,
        COUNT(first_name) as contacts_with_first_name,
        COUNT(last_name) as contacts_with_last_name
      FROM contacts;
    `);
    // Find contacts linked to deals that have contact_name but the contact doesn't have a name
    const namableContacts = await client.query(`
      SELECT DISTINCT
        c.id as contact_id,
        c.email,
        c.full_name as current_name,
        d.contact_name as deal_contact_name,
        COUNT(d.id) as deal_count
      FROM contacts c
      JOIN deals d ON c.id = d.primary_contact_id
      WHERE (c.full_name IS NULL OR c.full_name = '') 
        AND d.contact_name IS NOT NULL 
        AND d.contact_name != ''
      GROUP BY c.id, c.email, c.full_name, d.contact_name
      ORDER BY deal_count DESC
      LIMIT 100;
    `);
    if (namableContacts.rows.length > 0) {
      let updatedCount = 0;
      for (const contact of namableContacts.rows) {
        try {
          // Parse the name into first and last name
          const nameParts = contact.deal_contact_name.trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          const fullName = contact.deal_contact_name.trim();
          
          await client.query(`
            UPDATE contacts 
            SET 
              first_name = $1,
              last_name = $2,
              updated_at = NOW()
            WHERE id = $3;
          `, [firstName, lastName, contact.contact_id]);
          updatedCount++;
        } catch (error) {
        }
      }
    }

    // Handle contacts that don't have deal names - extract names from emails
    const emailNameableContacts = await client.query(`
      SELECT 
        c.id as contact_id,
        c.email,
        c.full_name as current_name
      FROM contacts c
      WHERE (c.full_name IS NULL OR c.full_name = '') 
        AND c.email IS NOT NULL 
        AND c.email LIKE '%@%'
        AND c.email NOT LIKE '%linkedin.com%'
        AND LENGTH(c.email) > 5
      LIMIT 100;
    `);
    if (emailNameableContacts.rows.length > 0) {
      let emailUpdatedCount = 0;
      for (const contact of emailNameableContacts.rows) {
        try {
          // Extract name from email (before @)
          const emailLocal = contact.email.split('@')[0];
          
          // Convert common email patterns to names
          let extractedName = emailLocal
            .replace(/[\.\-\_]/g, ' ')  // Replace dots, dashes, underscores with spaces
            .replace(/\d+/g, '')        // Remove numbers
            .split(' ')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ')
            .trim();
          
          // Only update if we got something reasonable (2+ characters, no special chars)
          if (extractedName.length >= 2 && /^[a-zA-Z\s]+$/.test(extractedName)) {
            const nameParts = extractedName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            await client.query(`
              UPDATE contacts 
              SET 
                first_name = $1,
                last_name = $2,
                updated_at = NOW()
              WHERE id = $3;
            `, [firstName, lastName, contact.contact_id]);
            emailUpdatedCount++;
          }
        } catch (error) {
        }
      }
    }

    // Final verification
    const finalStats = await client.query(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(full_name) as contacts_with_full_name,
        COUNT(CASE WHEN full_name IS NOT NULL AND full_name != '' THEN 1 END) as contacts_with_valid_names
      FROM contacts;
    `);
    // Show some examples
    const sampleUpdated = await client.query(`
      SELECT 
        c.email,
        c.full_name,
        c.first_name,
        c.last_name
      FROM contacts c
      WHERE c.full_name IS NOT NULL 
        AND c.full_name != ''
      ORDER BY c.updated_at DESC
      LIMIT 10;
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

populateContactNames().catch(console.error); 