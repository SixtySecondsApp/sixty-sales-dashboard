#!/usr/bin/env node

// Script to fix database relationships
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
function loadEnvVars() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        envVars[key.trim()] = value.replace(/^["']|["']$/g, ''); // Remove quotes
      }
    });
    
    return envVars;
  }
  return {};
}

const envVars = loadEnvVars();
const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabaseRelationships() {
  try {
    // First, check if the columns exist
    // Check if company_id column exists
    const { data: companyIdExists } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'deals')
      .eq('column_name', 'company_id')
      .limit(1);
      
    // Check if primary_contact_id column exists  
    const { data: contactIdExists } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'deals')
      .eq('column_name', 'primary_contact_id')
      .limit(1);
    // Since we can't run DDL via Supabase client, just inform user
    if (!companyIdExists || companyIdExists.length === 0 || !contactIdExists || contactIdExists.length === 0) {
    } else {
    }
    
    // Try to link existing data using DML operations
    // Link deals to existing contacts by email
    try {
      const { error: linkContactsError } = await supabase
        .rpc('link_deals_to_contacts');
        
      if (linkContactsError) {
      } else {
      }
    } catch (error) {
    }
    // Test the relationships
    const { data: testData, error: testError } = await supabase
      .from('deals')
      .select(`
        id,
        name,
        company,
        contact_name,
        company_id,
        primary_contact_id,
        companies:companies(name),
        contacts:contacts(full_name)
      `)
      .limit(1);
      
    if (testError) {
    } else {
    }
  } catch (error) {
    process.exit(1);
  }
}

// Run the fix
fixDatabaseRelationships(); 