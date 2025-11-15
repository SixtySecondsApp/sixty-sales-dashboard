#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function fixSpecificContacts() {
  try {
    await client.connect();

    // Update specific contacts
    const updates = [
      { email: 'tiffany@foundbenefits.com', firstName: 'Tiffany', lastName: '' },
      { email: 'hello@empauher.com', firstName: 'Hello', lastName: '' },
      { email: 'carolyn@marticulate.com', firstName: 'Carolyn', lastName: '' }
    ];

    for (const update of updates) {
      await client.query(`
        UPDATE contacts 
        SET first_name = $1, last_name = $2, updated_at = NOW()
        WHERE email = $3;
      `, [update.firstName, update.lastName, update.email]);
    }

    // Verify updates
    const verification = await client.query(`
      SELECT email, first_name, last_name, full_name 
      FROM contacts 
      WHERE email IN ('tiffany@foundbenefits.com', 'hello@empauher.com', 'carolyn@marticulate.com');
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

fixSpecificContacts().catch(console.error); 