#!/usr/bin/env node

// Test Supabase connection using the same config as the React app
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCompaniesAccess() {
  try {
    // Test basic query
    const { data, error, count } = await supabase
      .from('companies')
      .select('*', { count: 'exact' })
      .limit(3);
    
    if (error) {
      return;
    }
    // Test the exact query the useCompanies hook uses
    const { data: companiesWithStats, error: statsError } = await supabase
      .from('companies')
      .select(`
        *,
        contacts:contacts(count),
        deals:deals(count, value)
      `);
    
    if (statsError) {
    } else {
    }
    
  } catch (err) {
  }
}

testCompaniesAccess(); 