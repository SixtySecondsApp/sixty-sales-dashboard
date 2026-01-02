/**
 * Test script to manually trigger API monitor Slack notifications
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

async function testNotification() {
  console.log('🧪 Testing API Monitor Slack Notification');
  console.log('==========================================\n');
  console.log('Invoking edge function: api-monitor-notify\n');

  try {
    const { data, error } = await supabase.functions.invoke('api-monitor-notify', {
      body: {},
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('📨 Response:', JSON.stringify(data, null, 2));
    console.log('');

    if (data?.results) {
      const successCount = data.results.filter((r) => r.success).length;
      const totalCount = data.results.length;
      console.log(`\n✅ Sent ${successCount}/${totalCount} notifications`);
      
      data.results.forEach((result) => {
        if (result.success) {
          console.log(`  ✓ ${result.admin} - Notification sent successfully`);
        } else {
          console.log(`  ✗ ${result.admin}: ${result.error}`);
        }
      });
    } else if (data?.message) {
      console.log(`\nℹ️  ${data.message}`);
      if (data.message.includes('No high-priority')) {
        console.log('   This is expected if there are no critical issues detected.');
        console.log('   The function will only send notifications when:');
        console.log('   - Error rate > 5%');
        console.log('   - Bursts detected (>60 req/min)');
        console.log('   - Total errors > 100');
        console.log('   - AI review priority = "high"');
      }
    }
  } catch (err) {
    console.error('❌ Failed to invoke function:', err);
  }
}

testNotification();
