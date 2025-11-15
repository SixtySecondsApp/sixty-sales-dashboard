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
  process.exit(1);
}

// Create both clients for testing
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function debugIntegration() {
  // Test 1: Check current user
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  
  if (userError || !user) {
    return;
  }
  // Test 2: Query directly with service client
  const { data: serviceData, error: serviceError } = await serviceClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id);
  
  if (serviceError) {
  } else {
    if (serviceData && serviceData.length > 0) {
      serviceData.forEach((integration, index) => {
      });
    }
  }
  
  // Test 3: Try RPC function with anon client
  const { data: rpcData, error: rpcError } = await anonClient.rpc('get_my_google_integration');
  
  if (rpcError) {
  } else {
    if (rpcData) {
    }
  }
  
  // Test 4: Check if there's any active integration
  const { data: activeData, error: activeError } = await serviceClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);
  
  if (activeError) {
  } else {
    if (activeData && activeData.length > 0) {
    }
  }
  
  // Test 5: Check RPC function existence
  const { data: existsData, error: existsError } = await anonClient.rpc('check_google_integration_exists');
  
  if (existsError) {
  } else {
  }
  
  // Test 6: Direct table query with anon client (expect 406)
  const { data: directData, error: directError } = await anonClient
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id);
  
  if (directError) {
    if (directError.message.includes('406') || directError.code === '406') {
    } else {
    }
  } else {
  }
  if (serviceData && serviceData.length > 0 && !rpcData) {
  }
}

// Run the debug script
debugIntegration().catch(console.error);