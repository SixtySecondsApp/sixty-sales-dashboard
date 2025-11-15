#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function debugSpecificDeals() {
  try {
    await client.connect();

    // Get the specific deals that are failing
    const targetDeals = ['Founder Benefits', 'Empauher', 'Marticulate'];
    
    for (const dealName of targetDeals) {
      // Get the deal with its primary_contact_id
      const dealResult = await client.query(`
        SELECT id, name, primary_contact_id, contact_email, company_id
        FROM deals 
        WHERE name ILIKE $1
        LIMIT 1;
      `, [`%${dealName}%`]);
      
      if (dealResult.rows.length === 0) {
        continue;
      }
      
      const deal = dealResult.rows[0];
      // Try to find the contact by primary_contact_id
      if (deal.primary_contact_id) {
        const contactResult = await client.query(`
          SELECT id, first_name, last_name, full_name, email, phone, title
          FROM contacts 
          WHERE id = $1;
        `, [deal.primary_contact_id]);
        
        if (contactResult.rows.length > 0) {
        } else {
          // Try to find contacts with matching email
          const emailContactResult = await client.query(`
            SELECT id, first_name, last_name, full_name, email, phone, title
            FROM contacts 
            WHERE email = $1;
          `, [deal.contact_email]);
          
          if (emailContactResult.rows.length > 0) {
          } else {
          }
        }
      }
    }

    // Quick fix: Update deals to link to contacts with matching emails
    const fixResult = await client.query(`
      UPDATE deals 
      SET primary_contact_id = c.id
      FROM contacts c
      WHERE deals.contact_email = c.email 
        AND deals.primary_contact_id != c.id
        AND deals.contact_email IS NOT NULL
        AND c.email IS NOT NULL;
    `);
    // Test one more time
    const testDeal = await client.query(`
      SELECT d.name, d.primary_contact_id, c.full_name, c.email
      FROM deals d
      JOIN contacts c ON d.primary_contact_id = c.id
      WHERE d.name ILIKE '%Founder Benefits%'
      LIMIT 1;
    `);
    
    if (testDeal.rows.length > 0) {
    } else {
    }

  } catch (error) {
  } finally {
    await client.end();
  }
}

debugSpecificDeals().catch(console.error); 