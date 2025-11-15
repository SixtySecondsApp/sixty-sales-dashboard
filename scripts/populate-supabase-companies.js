#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

// Supabase client with service role
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Neon client (where our data is)
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function populateSupabaseCompanies() {
  try {
    await neonClient.connect();
    
    // Get all companies data from Neon
    const companiesResult = await neonClient.query(`
      SELECT 
        name, 
        domain, 
        industry, 
        size, 
        website, 
        description,
        created_at
      FROM companies 
      WHERE name IS NOT NULL
      ORDER BY created_at DESC;
    `);
    // Insert in batches
    const batchSize = 20;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < companiesResult.rows.length; i += batchSize) {
      const batch = companiesResult.rows.slice(i, i + batchSize);
      
      const { error: batchError } = await supabase
        .from('companies')
        .insert(
          batch.map(company => ({
            name: company.name?.trim(),
            domain: company.domain,
            industry: company.industry,
            size: company.size,
            website: company.website,
            description: company.description,
            created_at: company.created_at
          }))
        );
      
      if (batchError) {
        errorCount += batch.length;
      } else {
        successCount += batch.length;
      }
    }
    // Verify
    const { data: verifyData, error: verifyError, count } = await supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .limit(3);
    
    if (verifyError) {
    } else {
    }
    
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

populateSupabaseCompanies(); 