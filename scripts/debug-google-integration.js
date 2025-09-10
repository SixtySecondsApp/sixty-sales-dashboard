#!/usr/bin/env node

/**
 * Debug script for Google OAuth Integration
 * Tests if the integration data is being stored correctly
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
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create both clients for testing
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function debugIntegration() {
  console.log('🔍 Debugging Google OAuth Integration\n');
  
  // Test 1: Check current user
  console.log('1️⃣ Getting current user with anon client...');
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  
  if (userError || !user) {
    console.error('❌ No authenticated user found. Please login first.');
    return;
  }
  
  console.log('✅ Authenticated user:', {
    id: user.id,
    email: user.email,
    created_at: user.created_at
  });
  
  // Test 2: Query directly with service client
  console.log('\n2️⃣ Querying google_integrations with service client...');
  const { data: serviceData, error: serviceError } = await serviceClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id);
  
  if (serviceError) {
    console.error('❌ Service client query error:', serviceError);
  } else {
    console.log('✅ Service client found integrations:', serviceData?.length || 0);
    if (serviceData && serviceData.length > 0) {
      serviceData.forEach((integration, index) => {
        console.log(`   Integration ${index + 1}:`, {
          id: integration.id,
          email: integration.email,
          is_active: integration.is_active,
          created_at: integration.created_at,
          expires_at: integration.expires_at
        });
      });
    }
  }
  
  // Test 3: Try RPC function with anon client
  console.log('\n3️⃣ Testing RPC function get_my_google_integration...');
  const { data: rpcData, error: rpcError } = await anonClient.rpc('get_my_google_integration');
  
  if (rpcError) {
    console.error('❌ RPC function error:', rpcError);
  } else {
    console.log('✅ RPC function result:', rpcData ? 'Found integration' : 'No integration');
    if (rpcData) {
      console.log('   Integration:', {
        id: rpcData.id,
        email: rpcData.email,
        is_active: rpcData.is_active
      });
    }
  }
  
  // Test 4: Check if there's any active integration
  console.log('\n4️⃣ Checking for active integrations...');
  const { data: activeData, error: activeError } = await serviceClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);
  
  if (activeError) {
    console.error('❌ Active integration query error:', activeError);
  } else {
    console.log('✅ Active integrations found:', activeData?.length || 0);
    if (activeData && activeData.length > 0) {
      console.log('   Active integration:', {
        email: activeData[0].email,
        expires_at: activeData[0].expires_at
      });
    }
  }
  
  // Test 5: Check RPC function existence
  console.log('\n5️⃣ Testing RPC function check_google_integration_exists...');
  const { data: existsData, error: existsError } = await anonClient.rpc('check_google_integration_exists');
  
  if (existsError) {
    console.error('❌ RPC existence check error:', existsError);
  } else {
    console.log('✅ RPC existence check result:', existsData);
  }
  
  // Test 6: Direct table query with anon client (expect 406)
  console.log('\n6️⃣ Direct query with anon client (expect 406 error)...');
  const { data: directData, error: directError } = await anonClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id);
  
  if (directError) {
    if (directError.message.includes('406') || directError.code === '406') {
      console.log('⚠️  Expected 406 error confirmed');
    } else {
      console.error('❌ Unexpected error:', directError);
    }
  } else {
    console.log('✅ Direct query succeeded (unexpected):', directData?.length || 0, 'records');
  }
  
  console.log('\n📊 Summary:');
  console.log('- User ID:', user.id);
  console.log('- Total integrations in DB:', serviceData?.length || 0);
  console.log('- Active integrations:', activeData?.length || 0);
  console.log('- RPC function working:', !rpcError);
  console.log('- Direct query gets 406:', directError?.message.includes('406') || false);
  
  if (serviceData && serviceData.length > 0 && !rpcData) {
    console.log('\n⚠️  WARNING: Integration exists in DB but RPC function not returning it!');
    console.log('This might be due to:');
    console.log('1. RLS policies blocking access');
    console.log('2. RPC function using different user context');
    console.log('3. Integration not marked as active');
  }
}

// Run the debug script
debugIntegration().catch(console.error);