#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function testCompaniesAccess() {
  try {
    await client.connect();
    
    const result = await client.query('SELECT COUNT(*) as total_companies FROM companies;');
    // Test a few sample companies
    const sample = await client.query(`
      SELECT name, domain, size, industry 
      FROM companies 
      ORDER BY updated_at DESC 
      LIMIT 3;
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

testCompaniesAccess(); 