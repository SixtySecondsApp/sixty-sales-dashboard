#!/usr/bin/env node

/**
 * Generate initial API Monitor data
 * Creates a snapshot from recent audit_logs data
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
const envFile = join(__dirname, '..', '.env');
let envVars = {};
try {
  const envContent = readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (err) {
  console.warn('Could not read .env file, using process.env');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envVars.VITE_SUPABASE_URL || 'https://ygdpgliavpxeugaajgrb.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function generateData() {
  console.log('📊 Generating API Monitor Data');
  console.log('==============================\n');

  // Calculate time range (last 24 hours)
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

  console.log(`Time range: ${from.toISOString()} to ${to.toISOString()}\n`);

  try {
    // Create snapshot via edge function
    console.log('📸 Creating snapshot via Edge Function...');
    const { data: snapshotData, error: snapshotError } = await supabase.functions.invoke('api-monitor/snapshot', {
      body: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });

    if (snapshotError) {
      console.error('❌ Snapshot creation error:', snapshotError);
      throw snapshotError;
    }

    console.log('✅ Snapshot created:', snapshotData?.snapshot?.id || 'success');
    console.log(`   Total requests: ${snapshotData?.snapshot?.total_requests || 0}`);
    console.log(`   Total errors: ${snapshotData?.snapshot?.total_errors || 0}`);
    console.log(`   Error rate: ${snapshotData?.snapshot?.error_rate || 0}%\n`);

    // Fetch improvements to show they're seeded
    console.log('📋 Checking improvements...');
    const { data: improvementsData, error: improvementsError } = await supabase.functions.invoke('api-monitor/improvements', {
      method: 'GET',
    });

    if (improvementsError) {
      console.warn('⚠️  Could not fetch improvements:', improvementsError.message);
    } else {
      console.log(`✅ Found ${improvementsData?.improvements?.length || 0} improvements logged\n`);
    }

    console.log('==============================');
    console.log('✅ Data generation complete!');
    console.log('\nYou can now view the data at:');
    console.log('http://localhost:5175/platform/dev/api-monitor');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateData();
