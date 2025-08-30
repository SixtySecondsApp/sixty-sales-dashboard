-- Create missing tables for the sales dashboard

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table if it doesn't exist
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
  owner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contacts table if it doesn't exist
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  company_id UUID REFERENCES companies(id),
  owner_id UUID REFERENCES profiles(id),
  linkedin_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stages table (this is the correct name for our API)
CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  position INTEGER NOT NULL DEFAULT 0,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deals table if it doesn't exist
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0,
  stage_id UUID REFERENCES stages(id) NOT NULL,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  company_id UUID REFERENCES companies(id),
  primary_contact_id UUID REFERENCES contacts(id),
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  notes TEXT,
  deal_size TEXT,
  next_steps TEXT,
  lead_source TEXT,
  priority TEXT DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default stages if the table is empty
INSERT INTO stages (name, color, position, is_closed) 
SELECT * FROM (VALUES
  ('Lead', '#6B7280', 1, FALSE),
  ('Qualified', '#3B82F6', 2, FALSE),
  ('Proposal', '#F59E0B', 3, FALSE),
  ('Negotiation', '#EF4444', 4, FALSE),
  ('Closed Won', '#10B981', 5, TRUE),
  ('Closed Lost', '#6B7280', 6, TRUE)
) AS v(name, color, position, is_closed)
WHERE NOT EXISTS (SELECT 1 FROM stages);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts(owner_id);

CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);

CREATE INDEX IF NOT EXISTS idx_stages_position ON stages(position);

-- Create or update trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_deals_updated_at ON deals;
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stages_updated_at ON stages;
CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON stages
  FOR EACH ROW EXECUTE FUNCTION update_stages_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Companies policies
DROP POLICY IF EXISTS "Users can view companies" ON companies;
CREATE POLICY "Users can view companies" ON companies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert companies" ON companies;
CREATE POLICY "Users can insert companies" ON companies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update companies" ON companies;
CREATE POLICY "Users can update companies" ON companies FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Contacts policies
DROP POLICY IF EXISTS "Users can view contacts" ON contacts;
CREATE POLICY "Users can view contacts" ON contacts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
CREATE POLICY "Users can insert contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
CREATE POLICY "Users can update contacts" ON contacts FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Deals policies
DROP POLICY IF EXISTS "Users can view deals" ON deals;
CREATE POLICY "Users can view deals" ON deals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert deals" ON deals;
CREATE POLICY "Users can insert deals" ON deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update deals" ON deals;
CREATE POLICY "Users can update deals" ON deals FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Stages policies
DROP POLICY IF EXISTS "Users can view stages" ON stages;
CREATE POLICY "Users can view stages" ON stages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert stages" ON stages;
CREATE POLICY "Users can insert stages" ON stages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update stages" ON stages;
CREATE POLICY "Users can update stages" ON stages FOR UPDATE USING (auth.uid() IS NOT NULL); 