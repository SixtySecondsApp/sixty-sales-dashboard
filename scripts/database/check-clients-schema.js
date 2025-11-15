import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkClientsSchema() {
  try {
    // Check if clients table exists
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError) {
    } else {
    }

    // Check if client_billings table exists
    const { data: billingsData, error: billingsError } = await supabase
      .from('client_billings')
      .select('*')
      .limit(1);

    if (billingsError) {
    } else {
    }

    // Check if client_status_history table exists
    const { data: historyData, error: historyError } = await supabase
      .from('client_status_history')
      .select('*')
      .limit(1);

    if (historyError) {
    } else {
    }

  } catch (error) {
  }
}

checkClientsSchema().then(() => {
  process.exit(0);
}).catch(error => {
  process.exit(1);
});