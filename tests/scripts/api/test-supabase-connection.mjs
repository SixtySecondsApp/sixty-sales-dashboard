#!/usr/bin/env node
/**
 * Test Supabase Connection
 * Verifies that the development branch Supabase instance is accessible
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Supabase Connection...\n');

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables:');
  console.error(`   VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.error(`   VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
console.log();

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test connection
async function testConnection() {
  try {
    console.log('🔗 Testing connection to Supabase...');

    // Simple query to test connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Connection test failed:', error.message);
      console.error('   Error details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('✅ Successfully connected to Supabase!');
    console.log();

    // Test auth service
    console.log('🔐 Testing auth service...');
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError) {
      console.warn('⚠️  Auth test warning:', authError.message);
    } else {
      console.log(`✅ Auth service accessible (Session: ${session ? 'Active' : 'None'})`);
    }
    console.log();

    // Get some basic info
    console.log('📊 Database Information:');

    // Test profiles table
    const { count: profileCount, error: profileError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!profileError) {
      console.log(`   Profiles: ${profileCount} records`);
    }

    // Test deals table
    const { count: dealCount, error: dealError } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    if (!dealError) {
      console.log(`   Deals: ${dealCount} records`);
    }

    // Test contacts table
    const { count: contactCount, error: contactError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });

    if (!contactError) {
      console.log(`   Contacts: ${contactCount} records`);
    }

    console.log();
    console.log('✅ All tests passed! Your Supabase connection is working.');
    console.log();
    console.log('📝 Next steps:');
    console.log('   1. Restart your dev server (Ctrl+C then npm run dev)');
    console.log('   2. Refresh your browser');
    console.log('   3. The frontend should now connect successfully');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

testConnection();
