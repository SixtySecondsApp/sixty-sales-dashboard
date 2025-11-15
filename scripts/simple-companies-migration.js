#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

// Supabase client with service role (admin permissions)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Neon client (where our data is)
const neonClient = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
});

async function simpleCompaniesMigration() {
  try {
    // Connect to Neon
    await neonClient.connect();
    
    // Get a small sample of companies data from Neon first
    const companiesResult = await neonClient.query(`
      SELECT 
        name, 
        domain, 
        industry, 
        size, 
        website, 
        description
      FROM companies 
      WHERE name IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10;
    `);
    // Try to insert a single company first to see what happens
    const testCompany = companiesResult.rows[0];
    const { data: insertData, error: insertError } = await supabase
      .from('companies')
      .insert({
        name: testCompany.name,
        domain: testCompany.domain,
        industry: testCompany.industry,
        size: testCompany.size,
        website: testCompany.website,
        description: testCompany.description
      })
      .select();
    
    if (insertError) {
      // Let's see what tables DO exist and if we can create companies manually
      // Check if we can at least query existing tables
      const { data: dealsTest, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .limit(1);
      
      if (dealsError) {
      } else {
      }
      
    } else {
      // If successful, insert more companies
      let successCount = 1; // Already inserted one
      for (let i = 1; i < Math.min(5, companiesResult.rows.length); i++) {
        const company = companiesResult.rows[i];
        
        const { error: batchError } = await supabase
          .from('companies')
          .insert({
            name: company.name,
            domain: company.domain,
            industry: company.industry,
            size: company.size,
            website: company.website,
            description: company.description
          });
        
        if (batchError) {
        } else {
          successCount++;
        }
      }
      // Test the companies page
      const { data: finalTest, error: finalError, count } = await supabase
        .from('companies')
        .select('*', { count: 'exact' });
      
      if (finalError) {
      } else {
      }
    }
    
  } catch (error) {
  } finally {
    await neonClient.end();
  }
}

simpleCompaniesMigration(); 