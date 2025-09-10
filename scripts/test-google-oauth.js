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
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testGoogleIntegration() {
  console.log('🧪 Testing Google OAuth Integration\n');
  
  // Test 1: Check if RPC functions exist
  console.log('1️⃣ Testing RPC functions...');
  try {
    const { data, error } = await supabase.rpc('check_google_integration_exists');
    
    if (error) {
      console.error('❌ RPC function check_google_integration_exists failed:', error.message);
    } else {
      console.log('✅ RPC function check_google_integration_exists works');
      console.log('   Integration exists:', data);
    }
  } catch (err) {
    console.error('❌ Error calling RPC function:', err.message);
  }
  
  // Test 2: Try to get integration using RPC
  console.log('\n2️⃣ Testing get_my_google_integration RPC...');
  try {
    const { data, error } = await supabase.rpc('get_my_google_integration');
    
    if (error) {
      console.error('❌ RPC function get_my_google_integration failed:', error.message);
    } else {
      console.log('✅ RPC function get_my_google_integration works');
      if (data) {
        console.log('   Integration found:', {
          email: data.email,
          is_active: data.is_active,
          expires_at: data.expires_at
        });
      } else {
        console.log('   No integration found (expected if not connected)');
      }
    }
  } catch (err) {
    console.error('❌ Error calling RPC function:', err.message);
  }
  
  // Test 3: Try direct table access (should fail with 406)
  console.log('\n3️⃣ Testing direct table access (expect 406 error)...');
  try {
    const { data, error } = await supabase
      .from('google_integrations')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('406') || error.code === '406') {
        console.log('⚠️  Expected 406 error on direct access:', error.message);
        console.log('   This is why we use RPC functions');
      } else {
        console.error('❌ Unexpected error:', error.message);
      }
    } else {
      console.log('✅ Direct table access works (unexpected)');
      console.log('   Data:', data);
    }
  } catch (err) {
    console.error('❌ Error accessing table:', err.message);
  }
  
  // Test 4: Check Edge Functions are accessible
  console.log('\n4️⃣ Testing Edge Function accessibility...');
  try {
    // This should fail without auth, but we're checking if the function exists
    const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth-initiate`, {
      method: 'OPTIONS',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Edge Function google-oauth-initiate is accessible');
    } else if (response.status === 401) {
      console.log('✅ Edge Function google-oauth-initiate exists (auth required)');
    } else {
      console.log('⚠️  Edge Function returned status:', response.status);
    }
  } catch (err) {
    console.error('❌ Error accessing Edge Function:', err.message);
  }
  
  // Test 5: Verify frontend callback route
  console.log('\n5️⃣ Checking frontend callback route...');
  const callbackUrl = process.env.VITE_GOOGLE_REDIRECT_URI;
  if (callbackUrl) {
    console.log('✅ Callback URL configured:', callbackUrl);
    if (callbackUrl === 'http://localhost:5173/auth/google/callback') {
      console.log('   URL matches expected format');
    } else {
      console.log('⚠️  URL differs from expected format');
    }
  } else {
    console.error('❌ VITE_GOOGLE_REDIRECT_URI not set');
  }
  
  console.log('\n📊 Summary:');
  console.log('- RPC functions are the workaround for 406 errors');
  console.log('- Direct table access will fail with 406 (expected)');
  console.log('- Edge Functions handle OAuth flow');
  console.log('- Frontend acts as intermediary for callbacks');
  
  console.log('\n✨ To complete setup:');
  console.log('1. Run the SQL script: /scripts/fix-google-oauth-complete.sql');
  console.log('2. Configure Google OAuth credentials in Supabase Edge Functions');
  console.log('3. Update Google Console redirect URI to match .env.local');
  console.log('4. Test the flow at http://localhost:5173/integrations');
}

// Run the test
testGoogleIntegration().catch(console.error);