#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabaseTables() {
  try {
    console.log('📋 Checking tables in Supabase database...');
    
    // Try to get schema information via SQL
    const { data, error } = await supabase.rpc('get_tables_info', {});
    
    if (error) {
      console.log('🔍 Trying alternative approach...');
      
      // Check existing tables by trying to query them
      const knownTables = ['deals', 'deal_stages', 'activities', 'profiles', 'companies', 'contacts'];
      
      for (const table of knownTables) {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (tableError) {
          console.log(`❌ ${table}: ${tableError.message}`);
        } else {
          console.log(`✅ ${table}: exists`);
        }
      }
      
      return;
    }
    
    console.log('✅ Tables found:');
    console.table(data);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkSupabaseTables(); 