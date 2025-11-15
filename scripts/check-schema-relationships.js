#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkSchemaRelationships() {
  try {
    await client.connect();

    // Check if deals table has company_id column
    const dealsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'deals' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    // Check foreign key constraints on deals table
    const dealsForeignKeys = await client.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'deals'
        AND tc.table_schema = 'public';
    `);
    // Check if companies table exists
    const companiesExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      );
    `);
    if (companiesExists.rows[0].exists) {
      const companiesColumns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'companies' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `);
    }

    // Check if contacts table exists  
    const contactsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contacts'
      );
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

checkSchemaRelationships().catch(console.error); 