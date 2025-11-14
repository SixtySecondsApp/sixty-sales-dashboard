#!/usr/bin/env tsx
/**
 * Test script for SavvyCal link fetching functionality
 * 
 * Usage:
 *   tsx scripts/test-savvycal-link-fetch.ts <link_id>
 * 
 * Example:
 *   tsx scripts/test-savvycal-link-fetch.ts link_01G546GHBJD033660AV798D5FY
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetchLink(linkId: string) {
  console.log(`\n🔍 Testing fetch-savvycal-link function...`);
  console.log(`Link ID: ${linkId}\n`);

  try {
    // Get user session (required for authenticated edge function calls)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ Not authenticated. Please log in first.');
      console.error('Run: npm run dev and log in, then get your token from localStorage');
      process.exit(1);
    }

    console.log('✅ Authenticated with Supabase');

    // Invoke the edge function
    console.log(`📡 Calling fetch-savvycal-link edge function...`);
    const { data, error } = await supabase.functions.invoke('fetch-savvycal-link', {
      body: { link_id: linkId },
    });

    if (error) {
      console.error('❌ Error invoking function:', error);
      return;
    }

    if (data.success) {
      console.log('✅ Successfully fetched link details:');
      console.log(JSON.stringify(data.link, null, 2));
      
      // Suggest source based on link name
      const linkName = data.link.name || data.link.slug;
      console.log(`\n💡 Link Name: ${linkName}`);
      console.log(`💡 Suggested Source: Check if "${linkName}" matches any booking sources`);
    } else {
      console.error('❌ Function returned error:', data.error);
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Get link_id from command line args
const linkId = process.argv[2];

if (!linkId) {
  console.error('❌ Usage: tsx scripts/test-savvycal-link-fetch.ts <link_id>');
  console.error('\nExample:');
  console.error('  tsx scripts/test-savvycal-link-fetch.ts link_01G546GHBJD033660AV798D5FY');
  process.exit(1);
}

testFetchLink(linkId);


