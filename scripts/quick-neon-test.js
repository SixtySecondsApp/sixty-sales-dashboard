#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

// Using the same Neon connection string as the React app
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function quickTest() {
  try {
    await client.connect();
    
    // Test companies count
    const companiesResult = await client.query('SELECT COUNT(*) as count FROM companies');
    // Test deals count  
    const dealsResult = await client.query('SELECT COUNT(*) as count FROM deals');
    // Test deals with CRM relationships
    const crmDealsResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM deals d 
      WHERE d.company_id IS NOT NULL AND d.primary_contact_id IS NOT NULL
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

quickTest(); 