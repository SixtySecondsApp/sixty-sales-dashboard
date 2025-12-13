import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY env var (required).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyClientsMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250815000000_create_clients_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    // Execute the migration
    const { data, error } = await supabase.rpc('exec', { sql: migrationSQL });

    if (error) {
      throw error;
    }
    if (data) {
    }

    // Verify the tables were created
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(0);

    if (clientsError) {
    } else {
    }

    const { data: billingsData, error: billingsError } = await supabase
      .from('client_billings')
      .select('*')
      .limit(0);

    if (billingsError) {
    } else {
    }

    const { data: historyData, error: historyError } = await supabase
      .from('client_status_history')
      .select('*')
      .limit(0);

    if (historyError) {
    } else {
    }

  } catch (error) {
    throw error;
  }
}

applyClientsMigration().then(() => {
  process.exit(0);
}).catch(error => {
  process.exit(1);
});