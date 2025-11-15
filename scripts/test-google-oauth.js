#!/usr/bin/env node

/**
 * Test script for Google OAuth Integration
 * Verifies all components are working correctly
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testGoogleIntegration() {
  // Test 1: Check if RPC functions exist
  try {
    const { data, error } = await supabase.rpc('check_google_integration_exists');
    
    if (error) {
    } else {
    }
  } catch (err) {
  }
  
  // Test 2: Try to get integration using RPC
  try {
    const { data, error } = await supabase.rpc('get_my_google_integration');
    
    if (error) {
    } else {
      if (data) {
      } else {
      }
    }
  } catch (err) {
  }
  
  // Test 3: Try direct table access (should fail with 406)
  try {
    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('406') || error.code === '406') {
      } else {
      }
    } else {
    }
  } catch (err) {
  }
  
  // Test 4: Check Edge Functions are accessible
  try {
    // This should fail without auth, but we're checking if the function exists
    const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth-initiate`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
    } else if (response.status === 401) {
    } else {
    }
  } catch (err) {
  }
  
  // Test 5: Verify frontend callback route
  const callbackUrl = process.env.VITE_GOOGLE_REDIRECT_URI;
  if (callbackUrl) {
    if (callbackUrl === 'http://localhost:5173/auth/google/callback') {
    } else {
    }
  } else {
  }
}

// Run the test
testGoogleIntegration().catch(console.error);