#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function fixContactLinking() {
  try {
    await client.connect();

    // Check if primary_contact_id values exist in contacts table
    const orphanedDeals = await client.query(`
      SELECT 
        d.id,
        d.name,
        d.primary_contact_id,
        CASE WHEN c.id IS NULL THEN 'ORPHANED' ELSE 'LINKED' END as link_status
      FROM deals d
      LEFT JOIN contacts c ON d.primary_contact_id = c.id
      WHERE d.primary_contact_id IS NOT NULL
      LIMIT 10;
    `);
    // Count orphaned vs linked
    const linkStats = await client.query(`
      SELECT 
        COUNT(CASE WHEN c.id IS NULL THEN 1 END) as orphaned_count,
        COUNT(CASE WHEN c.id IS NOT NULL THEN 1 END) as linked_count
      FROM deals d
      LEFT JOIN contacts c ON d.primary_contact_id = c.id
      WHERE d.primary_contact_id IS NOT NULL;
    `);
    // If we have orphaned deals, let's fix them by matching email addresses
    const orphanedCount = parseInt(linkStats.rows[0].orphaned_count);
    
    if (orphanedCount > 0) {
      // Find deals that can be matched by email
      const matchableDeals = await client.query(`
        SELECT 
          d.id as deal_id,
          d.name as deal_name,
          d.contact_email,
          c.id as contact_id,
          c.email as contact_email,
          c.full_name
        FROM deals d
        LEFT JOIN contacts correct_contact ON d.primary_contact_id = correct_contact.id
        JOIN contacts c ON d.contact_email = c.email
        WHERE d.primary_contact_id IS NOT NULL 
          AND correct_contact.id IS NULL
          AND d.contact_email IS NOT NULL
        LIMIT 20;
      `);
      if (matchableDeals.rows.length > 0) {
        let fixedCount = 0;
        for (const match of matchableDeals.rows) {
          try {
            await client.query(`
              UPDATE deals 
              SET primary_contact_id = $1 
              WHERE id = $2;
            `, [match.contact_id, match.deal_id]);
            fixedCount++;
          } catch (error) {
          }
        }
      }
    } else {
    }

    // Final verification
    const verificationDeals = await client.query(`
      SELECT 
        d.id,
        d.name,
        d.contact_email as deal_contact_email,
        c.email as linked_contact_email,
        c.full_name as linked_contact_name
      FROM deals d
      JOIN contacts c ON d.primary_contact_id = c.id
      WHERE d.primary_contact_id IS NOT NULL
      LIMIT 5;
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

fixContactLinking().catch(console.error); 