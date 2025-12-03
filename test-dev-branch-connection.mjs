#!/usr/bin/env node

/**
 * Test connection to new development-v2 branch
 * Run with: node test-dev-branch-connection.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 Testing Development Branch Connection');
console.log('=========================================\n');

console.log(`URL: ${supabaseUrl}`);
console.log(`Branch: development-v2 (jczngsvpywgrlgdwzjbr)`);
console.log(`Status: Should show MIGRATIONS_FAILED (OK)\n`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('1️⃣  Testing basic connection...');

    // Test basic connection by querying profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Connection failed:', error.message);

      if (error.message.includes('relation "profiles" does not exist')) {
        console.log('\n⚠️  The profiles table does not exist yet.');
        console.log('This is expected for a new branch - data needs to be synced.');
        console.log('\nNext steps:');
        console.log('1. Run the GitHub Actions workflow to sync production data');
        console.log('2. Or wait for Sunday 2 AM UTC automatic sync');
        console.log('3. Or manually copy data using the scripts in COMPLETE_BRANCH_SETUP.md');
        return;
      }

      process.exit(1);
    }

    console.log('✅ Basic connection successful!\n');

    // Get table counts
    console.log('2️⃣  Checking database tables...');

    const tables = [
      'profiles',
      'deals',
      'activities',
      'meetings',
      'tasks',
      'organizations'
    ];

    for (const table of tables) {
      try {
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (countError) {
          if (countError.message.includes('does not exist')) {
            console.log(`   ⚠️  ${table}: Table not found (needs data sync)`);
          } else {
            console.log(`   ❌ ${table}: Error - ${countError.message}`);
          }
        } else {
          console.log(`   ✅ ${table}: ${count} records`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${table}: ${err.message}`);
      }
    }

    console.log('\n3️⃣  Connection test complete!\n');

    if (data === null) {
      console.log('📋 Summary:');
      console.log('   • Connection: ✅ Working');
      console.log('   • Database schema: ⚠️  Empty (needs data sync)');
      console.log('   • Action needed: Sync production data to this branch');
      console.log('\nRun the data sync workflow or wait for automatic Sunday sync.');
    } else {
      console.log('🎉 Everything looks good!');
      console.log('   • Connection: ✅ Working');
      console.log('   • Database: ✅ Has data');
      console.log('   • Ready for development!');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

testConnection();
