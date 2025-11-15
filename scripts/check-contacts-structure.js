#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function checkContactsStructure() {
  try {
    await client.connect();

    // Check contacts table structure
    const contactsColumns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    // Check if there's data in contacts
    const contactsCount = await client.query('SELECT COUNT(*) as count FROM contacts');
    // Sample a few contacts to see the data structure
    if (parseInt(contactsCount.rows[0].count) > 0) {
      const sampleContacts = await client.query('SELECT * FROM contacts LIMIT 3');
    }

    // Check existing companies table if it exists
    const companiesExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'companies'
      );
    `);
    
    if (companiesExists.rows[0].exists) {
      const companiesColumns = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'companies' 
          AND table_schema = 'public'
        ORDER BY ordinal_position;
      `);
    } else {
    }

    // Check for foreign key relationships
    const dealsFkeys = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'deals';
    `);
    
    if (dealsFkeys.rows.length > 0) {
    } else {
    }

    // Check if deals has company_id or primary_contact_id columns
    const dealsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'deals' 
        AND table_schema = 'public'
        AND column_name IN ('company_id', 'primary_contact_id')
      ORDER BY column_name;
    `);
    
    if (dealsColumns.rows.length > 0) {
    } else {
    }

    // Check activities table for relationship columns  
    const activitiesColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'activities' 
        AND table_schema = 'public'
        AND column_name IN ('company_id', 'contact_id', 'deal_id', 'auto_matched')
      ORDER BY column_name;
    `);
    
    if (activitiesColumns.rows.length > 0) {
    } else {
    }
    
  } catch (error) {
  } finally {
    await client.end();
  }
}

checkContactsStructure().catch(console.error); 