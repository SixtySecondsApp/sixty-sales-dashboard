import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function createCompaniesTableDirect() {
  try {
    // Execute SQL directly using the PostgreSQL driver through Supabase
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        -- Create companies table
        CREATE TABLE IF NOT EXISTS companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          domain TEXT UNIQUE,
          industry TEXT,
          size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
          website TEXT,
          address TEXT,
          phone TEXT,
          description TEXT,
          linkedin_url TEXT,
          owner_id UUID REFERENCES profiles(id) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
        CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
        CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

        -- Create updated_at trigger function if it doesn't exist
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Create trigger for companies
        DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
        CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        -- Enable Row Level Security
        ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        DROP POLICY IF EXISTS "Users can view their own companies" ON companies;
        CREATE POLICY "Users can view their own companies" ON companies
          FOR SELECT USING (auth.uid() = owner_id);

        DROP POLICY IF EXISTS "Users can insert their own companies" ON companies;
        CREATE POLICY "Users can insert their own companies" ON companies
          FOR INSERT WITH CHECK (auth.uid() = owner_id);

        DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
        CREATE POLICY "Users can update their own companies" ON companies
          FOR UPDATE USING (auth.uid() = owner_id);

        DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
        CREATE POLICY "Users can delete their own companies" ON companies
          FOR DELETE USING (auth.uid() = owner_id);
      `
    });

    if (error) {
      return;
    }
    // Test the table
    const { data: testData, error: testError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);

    if (testError) {
    } else {
    }

  } catch (error) {
  }
}

createCompaniesTableDirect(); 