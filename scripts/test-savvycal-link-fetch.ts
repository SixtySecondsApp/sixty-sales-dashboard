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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetchLink(linkId: string) {
  try {
    // Get user session (required for authenticated edge function calls)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      process.exit(1);
    }
    // Invoke the edge function
    const { data, error } = await supabase.functions.invoke('fetch-savvycal-link', {
      body: { link_id: linkId },
    });

    if (error) {
      return;
    }

    if (data.success) {
      // Suggest source based on link name
      const linkName = data.link.name || data.link.slug;
    } else {
    }
  } catch (error: any) {
  }
}

// Get link_id from command line args
const linkId = process.argv[2];

if (!linkId) {
  process.exit(1);
}

testFetchLink(linkId);






