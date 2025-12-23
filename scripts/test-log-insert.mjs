import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function insertTestLog() {
  console.log('Inserting test log to integration_sync_logs...');
  console.log('URL:', supabaseUrl);

  const { data, error } = await supabase
    .from('integration_sync_logs')
    .insert({
      integration_name: 'hubspot',
      operation: 'sync',
      direction: 'inbound',
      entity_type: 'test',
      entity_name: 'Test Log Entry - Infrastructure Verification',
      status: 'success',
      metadata: { test: true, message: 'Verifying logging infrastructure works', timestamp: new Date().toISOString() }
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting log:', error);
    process.exit(1);
  }

  console.log('✅ Success! Log inserted:');
  console.log(JSON.stringify(data, null, 2));

  // Verify we can read it back
  const { data: logs, error: readError } = await supabase
    .from('integration_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (readError) {
    console.error('Error reading logs:', readError);
  } else {
    console.log('\n📋 Recent logs in table:', logs.length);
  }
}

insertTestLog();
