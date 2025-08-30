import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyClientsMigration() {
  console.log('🚀 Applying clients table migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250815000000_create_clients_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded successfully');
    console.log('📏 Migration size:', migrationSQL.length, 'characters\n');

    // Execute the migration
    console.log('⚡ Executing migration...');
    const { data, error } = await supabase.rpc('exec', { sql: migrationSQL });

    if (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    console.log('✅ Migration executed successfully!');
    if (data) {
      console.log('📊 Migration result:', data);
    }

    // Verify the tables were created
    console.log('\n🔍 Verifying table creation...');

    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(0);

    if (clientsError) {
      console.log('❌ Clients table verification failed:', clientsError.message);
    } else {
      console.log('✅ Clients table created successfully!');
    }

    const { data: billingsData, error: billingsError } = await supabase
      .from('client_billings')
      .select('*')
      .limit(0);

    if (billingsError) {
      console.log('❌ Client_billings table verification failed:', billingsError.message);
    } else {
      console.log('✅ Client_billings table created successfully!');
    }

    const { data: historyData, error: historyError } = await supabase
      .from('client_status_history')
      .select('*')
      .limit(0);

    if (historyError) {
      console.log('❌ Client_status_history table verification failed:', historyError.message);
    } else {
      console.log('✅ Client_status_history table created successfully!');
    }

  } catch (error) {
    console.error('💥 Fatal error applying migration:', error);
    throw error;
  }
}

applyClientsMigration().then(() => {
  console.log('\n🎉 Migration applied successfully!');
  console.log('📋 Client subscription management tables are ready for use.');
  process.exit(0);
}).catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});