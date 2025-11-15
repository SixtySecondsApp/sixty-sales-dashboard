#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const { Client } = pkg;

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Neon client (where our data is)
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function createCompaniesSimple() {
  try {
    // First, try to insert companies directly (the table might already exist)
    await neonClient.connect();
    
    // Get a sample of companies data from Neon
    const companiesResult = await neonClient.query(`
      SELECT 
        name, 
        domain, 
        industry, 
        size, 
        website, 
        description,
        created_at,
        updated_at
      FROM companies 
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    // Try inserting companies without owner_id requirement
    let successCount = 0;
    let errorCount = 0;
    
    for (const company of companiesResult.rows.slice(0, 3)) {
      const { error: insertError } = await supabase
        .from('companies')
        .insert({
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          size: company.size,
          website: company.website,
          description: company.description
        });
      
      if (insertError) {
        errorCount++;
        
        // If the error is that the table doesn't exist, we need to create it
        if (insertError.message.includes('does not exist')) {
          break;
        }
      } else {
        successCount++;
      }
    }
    
    if (successCount > 0) {
      // Test the companies page functionality
      const { data: testData, error: testError } = await supabase
        .from('companies')
        .select('*', { count: 'exact' })
        .limit(3);
      
      if (testError) {
      } else {
      }
    } else {
    }
    
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

createCompaniesSimple(); 