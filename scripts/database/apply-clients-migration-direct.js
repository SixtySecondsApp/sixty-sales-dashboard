import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createClientsTable() {
  // Create clients table
  const createClientsSQL = `
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      primary_contact_name TEXT,
      primary_contact_email TEXT,
      subscription_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      subscription_start_date DATE,
      status TEXT NOT NULL DEFAULT 'signed' CHECK (status IN ('signed', 'deposit_paid', 'subscribed', 'notice_given', 'churned')),
      churn_date DATE,
      one_off_revenue DECIMAL(10,2) DEFAULT 0,
      notice_given_date DATE,
      last_billing_date DATE,
      owner_id UUID REFERENCES profiles(id),
      deal_id UUID REFERENCES deals(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  try {
    const { error: clientsError } = await supabase.rpc('exec_sql', { sql: createClientsSQL });
    
    if (clientsError) {
      // Alternative: Use the REST API to create the table
      const { error: altError } = await supabase
        .from('__table_creation_test')
        .select('*')
        .limit(0);
        
      // Since that won't work either, let's use pg_query
      throw new Error('Need to create tables through Supabase dashboard or different method');
    }
  } catch (error) {
    // Also show the remaining tables
  }
}

createClientsTable();