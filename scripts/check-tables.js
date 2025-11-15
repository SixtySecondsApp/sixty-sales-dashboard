#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkTables() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    result.rows.forEach(row => undefined);
    
    // Check specifically for CRM tables
    const crmTables = ['companies', 'contacts', 'deal_contacts', 'contact_preferences', 'activity_sync_rules'];
    const existingTables = result.rows.map(r => r.table_name);
    crmTables.forEach(table => {
      const exists = existingTables.includes(table);
    });
    
  } catch (error) {
  } finally {
    await client.end();
  }
}

checkTables(); 