import pkg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

// Your Neon connection
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

// Supabase client (if configured)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

async function diagnoseSetup() {
  try {
    // Step 1: Test Neon connection
    await neonClient.connect();
    // Check tables in Neon
    const tablesResult = await neonClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    tablesResult.rows.forEach(row => undefined);

    // Step 2: Check contacts and companies data
    const contactsCount = await neonClient.query('SELECT COUNT(*) FROM contacts');
    const companiesCount = await neonClient.query('SELECT COUNT(*) FROM companies');
    // Sample contact with company relationship
    const sampleContact = await neonClient.query(`
      SELECT 
        c.id, c.email, c.full_name, c.company_id,
        comp.name as company_name
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      LIMIT 1
    `);

    if (sampleContact.rows.length > 0) {
    }

    // Step 3: Check foreign key relationships
    const foreignKeys = await neonClient.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('contacts', 'deals', 'activities')
    `);

    if (foreignKeys.rows.length > 0) {
    } else {
    }

    // Step 4: Test Express API endpoints
    try {
      const apiTests = [
        'http://localhost:8000/api/health',
        'http://localhost:8000/api/contacts?limit=1&includeCompany=true',
        'http://localhost:8000/api/companies?limit=1&includeStats=true'
      ];

      for (const url of apiTests) {
        try {
          const response = await fetch(url);
          const data = await response.json();
        } catch (err) {
        }
      }
    } catch (err) {
    }

    // Step 5: Test Supabase connection (if configured)
    if (supabase) {
      try {
        const { data: supabaseContacts, error } = await supabase
          .from('contacts')
          .select('*')
          .limit(1);
        
        if (error) {
        } else {
        }
      } catch (err) {
      }
    } else {
    }

    // Step 6: Architecture Analysis
    // Step 7: Provide specific contact record fix
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

// Run the diagnostic
diagnoseSetup(); 