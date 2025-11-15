#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkSchema() {
  try {
    await client.connect();
    // Check schemas
    const schemas = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name;
    `);
    // Check existing tables
    const tables = await client.query(`
      SELECT 
        schemaname, 
        tablename, 
        tableowner
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schemaname, tablename;
    `);
    // Check for users/auth related tables
    const userTables = await client.query(`
      SELECT tablename, schemaname
      FROM pg_tables 
      WHERE tablename ILIKE '%user%' OR tablename ILIKE '%auth%'
      ORDER BY tablename;
    `);
    
    if (userTables.rows.length > 0) {
    } else {
    }

    // Check if we have deals/activities tables
    const crmTables = await client.query(`
      SELECT tablename, schemaname
      FROM pg_tables 
      WHERE tablename IN ('deals', 'activities', 'deal_stages', 'deal_activities', 'profiles')
      ORDER BY tablename;
    `);
    
    if (crmTables.rows.length > 0) {
      // Show sample structure of key tables
      for (const table of crmTables.rows) {
        try {
          const columns = await client.query(`
            SELECT 
              column_name, 
              data_type, 
              is_nullable,
              column_default
            FROM information_schema.columns 
            WHERE table_name = '${table.tablename}' 
              AND table_schema = '${table.schemaname}'
            ORDER BY ordinal_position;
          `);
        } catch (e) {
        }
      }
    } else {
    }

    // Check extensions
    const extensions = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      ORDER BY extname;
    `);
  } catch (error) {
  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error); 