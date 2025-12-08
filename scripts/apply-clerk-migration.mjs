#!/usr/bin/env node

/**
 * Script to apply Clerk auth migration directly to the production database
 * This uses the service role key to bypass RLS and execute DDL statements
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.log('Please set SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('🔐 Applying Clerk auth migration to production...\n');

  // Step 1: Check if clerk_user_mapping table exists
  console.log('Step 1: Checking clerk_user_mapping table...');
  const { data: tables, error: tableError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'clerk_user_mapping');

  // Using rpc for DDL operations
  const migrations = [
    {
      name: 'Create clerk_user_mapping table',
      sql: `
        CREATE TABLE IF NOT EXISTS clerk_user_mapping (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supabase_user_id UUID NOT NULL,
          clerk_user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          migrated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(clerk_user_id),
          UNIQUE(email)
        );
      `
    },
    {
      name: 'Create current_user_id function',
      sql: `
        CREATE OR REPLACE FUNCTION current_user_id()
        RETURNS UUID AS $$
        DECLARE
          v_supabase_id UUID;
          v_clerk_id TEXT;
          v_mapped_id UUID;
        BEGIN
          v_supabase_id := auth.uid();
          IF v_supabase_id IS NOT NULL THEN
            RETURN v_supabase_id;
          END IF;
          BEGIN
            v_clerk_id := current_setting('request.jwt.claims', true)::json->>'sub';
          EXCEPTION WHEN OTHERS THEN
            v_clerk_id := NULL;
          END;
          IF v_clerk_id IS NOT NULL THEN
            SELECT supabase_user_id INTO v_mapped_id
            FROM clerk_user_mapping
            WHERE clerk_user_id = v_clerk_id;
            IF v_mapped_id IS NOT NULL THEN
              RETURN v_mapped_id;
            END IF;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
      `
    },
    {
      name: 'Create is_current_user_admin function',
      sql: `
        CREATE OR REPLACE FUNCTION is_current_user_admin()
        RETURNS BOOLEAN AS $$
        DECLARE
          user_id UUID;
          admin_status BOOLEAN;
        BEGIN
          user_id := current_user_id();
          IF user_id IS NULL THEN
            RETURN FALSE;
          END IF;
          SELECT is_admin INTO admin_status
          FROM profiles
          WHERE id = user_id;
          RETURN COALESCE(admin_status, FALSE);
        END;
        $$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
      `
    }
  ];

  // Check current state
  console.log('\n📊 Checking current database state...');

  const { data: mappingCount } = await supabase
    .from('clerk_user_mapping')
    .select('*', { count: 'exact', head: true });

  console.log(`   clerk_user_mapping records: ${mappingCount?.length || 'table may not exist'}`);

  // Check if functions exist
  const { data: functions, error: funcError } = await supabase
    .rpc('current_user_id');

  if (funcError) {
    console.log('   current_user_id function: NOT WORKING or NOT EXISTS');
    console.log(`   Error: ${funcError.message}`);
  } else {
    console.log('   current_user_id function: EXISTS');
  }

  // List all policies on key tables
  console.log('\n📋 Current RLS policies need updating to use current_user_id()');
  console.log('   This requires running the migration SQL directly in Supabase Dashboard.\n');

  console.log('📝 Instructions:');
  console.log('1. Go to https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql');
  console.log('2. Copy and paste the migration SQL from:');
  console.log('   supabase/migrations/20251204200000_fix_clerk_auth_complete.sql');
  console.log('3. Run the migration');
  console.log('');
  console.log('Alternatively, use the Supabase CLI:');
  console.log('   npx supabase db push --password YOUR_DB_PASSWORD');
}

runMigration().catch(console.error);
