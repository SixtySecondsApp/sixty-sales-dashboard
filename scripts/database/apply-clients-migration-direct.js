import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing VITE_SUPABASE_SERVICE_ROLE_KEY env var (required).');
  process.exit(1);
}

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