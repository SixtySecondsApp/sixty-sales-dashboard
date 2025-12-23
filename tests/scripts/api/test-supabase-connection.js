#!/usr/bin/env node

/**
 * Quick test script to verify Supabase connection
 * Run with: node test-supabase-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? '***' + supabaseKey.slice(-10) : 'NOT SET');

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing environment variables!');
  console.error('Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection by querying the profiles table
async function testConnection() {
  try {
    console.log('\n📊 Testing database connection...');

    // Simple query to test connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('\n❌ Connection failed:', error.message);
      console.error('Details:', error);
      return false;
    }

    console.log('✅ Connection successful!');
    console.log('✅ Can query database tables');

    // Check if we're on development or production
    const isDev = supabaseUrl.includes('yjdzlbivjddcumtevggd');
    console.log('\n🌍 Environment:', isDev ? '🔧 DEVELOPMENT BRANCH' : '🚀 PRODUCTION');

    return true;
  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    return false;
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ All tests passed!');
      console.log('🎉 Your local environment is ready for development\n');
      process.exit(0);
    } else {
      console.log('\n❌ Tests failed. Check your configuration.\n');
      process.exit(1);
    }
  });
