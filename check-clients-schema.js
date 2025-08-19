import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkClientsSchema() {
  console.log('🔍 Checking if clients tables exist...\n');

  try {
    // Check if clients table exists
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError) {
      console.log('❌ Clients table does not exist:', clientsError.message);
    } else {
      console.log('✅ Clients table exists!');
      console.log('Sample data structure:', clientsData);
    }

    // Check if client_billings table exists
    const { data: billingsData, error: billingsError } = await supabase
      .from('client_billings')
      .select('*')
      .limit(1);

    if (billingsError) {
      console.log('❌ Client_billings table does not exist:', billingsError.message);
    } else {
      console.log('✅ Client_billings table exists!');
      console.log('Sample data structure:', billingsData);
    }

    // Check if client_status_history table exists
    const { data: historyData, error: historyError } = await supabase
      .from('client_status_history')
      .select('*')
      .limit(1);

    if (historyError) {
      console.log('❌ Client_status_history table does not exist:', historyError.message);
    } else {
      console.log('✅ Client_status_history table exists!');
      console.log('Sample data structure:', historyData);
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkClientsSchema().then(() => {
  console.log('\n🎉 Schema check complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});