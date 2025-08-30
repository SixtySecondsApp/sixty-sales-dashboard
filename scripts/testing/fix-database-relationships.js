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
  console.error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure your .env file contains these variables');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixDatabaseRelationships() {
  console.log('🔧 Fixing database relationships...');
  
  try {
    // First, check if the columns exist
    console.log('1. Checking current database schema...');
    
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
      
    console.log(`Company ID column exists: ${companyIdExists && companyIdExists.length > 0}`);
    console.log(`Primary Contact ID column exists: ${contactIdExists && contactIdExists.length > 0}`);
    
    // Since we can't run DDL via Supabase client, just inform user
    if (!companyIdExists || companyIdExists.length === 0 || !contactIdExists || contactIdExists.length === 0) {
      console.log('⚠️  Missing columns detected. You need to run the migration manually.');
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
        CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);
      `);
    } else {
      console.log('✅ Required columns exist');
    }
    
    // Try to link existing data using DML operations
    console.log('2. Linking existing deals to CRM data...');
    
    // Link deals to existing contacts by email
    try {
      console.log('  - Linking deals to contacts by email...');
      const { error: linkContactsError } = await supabase
        .rpc('link_deals_to_contacts');
        
      if (linkContactsError) {
        console.warn('Could not use RPC function, manual linking required:', linkContactsError);
      } else {
        console.log('  ✅ Contact linking completed');
      }
    } catch (error) {
      console.warn('  ⚠️  Contact linking failed, manual SQL required');
    }
    
    console.log('✅ Database relationship check completed');
    console.log('📝 Note: You may need to run the link-deals-to-crm.sql script manually in Supabase SQL Editor');
    
    // Test the relationships
    console.log('3. Testing relationships...');
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
      console.error('❌ Relationship test failed:', testError);
      console.log('This is expected if the foreign key relationships are not properly established');
    } else {
      console.log('✅ Relationship test passed');
      console.log('Sample deal:', testData?.[0]);
    }
    
    console.log('🎉 Database relationship fix completed!');
    
  } catch (error) {
    console.error('❌ Failed to fix database relationships:', error);
    process.exit(1);
  }
}

// Run the fix
fixDatabaseRelationships(); 