import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createClientsTable() {
  console.log('🚀 Creating clients table...\n');

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
    console.log('⚡ Creating clients table...');
    const { error: clientsError } = await supabase.rpc('exec_sql', { sql: createClientsSQL });
    
    if (clientsError) {
      console.log('❌ Direct table creation failed, trying alternative method...');
      
      // Alternative: Use the REST API to create the table
      const { error: altError } = await supabase
        .from('__table_creation_test')
        .select('*')
        .limit(0);
        
      // Since that won't work either, let's use pg_query
      throw new Error('Need to create tables through Supabase dashboard or different method');
    }

    console.log('✅ Clients table created successfully!');

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.log('\n📋 Manual SQL to run in Supabase SQL Editor:');
    console.log('=' .repeat(60));
    console.log(createClientsSQL);
    console.log('=' .repeat(60));
    
    // Also show the remaining tables
    console.log('\n-- Client Billings Table:');
    console.log(`
CREATE TABLE IF NOT EXISTS client_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  billing_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('deposit', 'monthly', 'one_off')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
    `);
    
    console.log('\n-- Client Status History Table:');
    console.log(`
CREATE TABLE IF NOT EXISTS client_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by UUID REFERENCES profiles(id),
  notes TEXT
);
    `);

    console.log('\n-- RLS Policies:');
    console.log(`
-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Users can view their own clients" ON clients
  FOR SELECT USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own clients" ON clients
  FOR INSERT WITH CHECK (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own clients" ON clients
  FOR UPDATE USING (owner_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own clients" ON clients
  FOR DELETE USING (owner_id = auth.uid() OR is_admin());

-- RLS Policies for client_billings
CREATE POLICY "Users can view billings for their clients" ON client_billings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = client_billings.client_id 
      AND (clients.owner_id = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can insert billings for their clients" ON client_billings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = client_billings.client_id 
      AND (clients.owner_id = auth.uid() OR is_admin())
    )
  );

-- RLS Policies for client_status_history
CREATE POLICY "Users can view status history for their clients" ON client_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = client_status_history.client_id 
      AND (clients.owner_id = auth.uid() OR is_admin())
    )
  );

-- Status change trigger
CREATE OR REPLACE FUNCTION track_client_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO client_status_history (client_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER client_status_change_trigger
  AFTER UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION track_client_status_changes();

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('\n🎯 Please copy and paste the above SQL into the Supabase SQL Editor to create the tables.');
  }
}

createClientsTable();