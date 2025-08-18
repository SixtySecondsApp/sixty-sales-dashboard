/*
  # Create Clients Table for Subscription Management
  
  This migration creates the MVP clients table for subscription management with:
  
  1. Core client information
  2. Subscription status tracking (active, churned, paused)  
  3. MRR tracking and calculations
  4. Integration with existing deals table
  5. Row Level Security policies
  
  Schema:
  - id (UUID, primary key)
  - company_name (TEXT, not null)
  - contact_name (TEXT, nullable)
  - contact_email (TEXT, nullable)
  - subscription_amount (DECIMAL, monthly MRR)
  - status (ENUM: 'active', 'churned', 'paused')
  - deal_id (UUID, foreign key to deals, nullable)
  - owner_id (UUID, foreign key to profiles, not null)
  - subscription_start_date (DATE, nullable)
  - churn_date (DATE, nullable)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
*/

-- Create client status enum
CREATE TYPE client_status AS ENUM ('active', 'churned', 'paused');

-- Create the clients table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  subscription_amount DECIMAL(12,2) DEFAULT 0 CHECK (subscription_amount >= 0),
  status client_status NOT NULL DEFAULT 'active',
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_start_date DATE,
  churn_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraints
ALTER TABLE clients 
  ADD CONSTRAINT check_churn_date_only_when_churned 
  CHECK (
    (status = 'churned' AND churn_date IS NOT NULL) OR 
    (status != 'churned' AND churn_date IS NULL)
  );

ALTER TABLE clients
  ADD CONSTRAINT check_subscription_start_date_valid
  CHECK (subscription_start_date <= CURRENT_DATE);

ALTER TABLE clients
  ADD CONSTRAINT check_churn_date_after_start
  CHECK (churn_date IS NULL OR subscription_start_date IS NULL OR churn_date >= subscription_start_date);

-- Create unique constraint to prevent duplicate deals being converted
ALTER TABLE clients
  ADD CONSTRAINT unique_deal_conversion
  UNIQUE (deal_id) DEFERRABLE INITIALLY DEFERRED;

-- Create indexes for performance
CREATE INDEX idx_clients_owner_id ON clients(owner_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_subscription_amount ON clients(subscription_amount) WHERE subscription_amount > 0;
CREATE INDEX idx_clients_deal_id ON clients(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_clients_subscription_start_date ON clients(subscription_start_date);
CREATE INDEX idx_clients_churn_date ON clients(churn_date) WHERE churn_date IS NOT NULL;
CREATE INDEX idx_clients_company_name ON clients(company_name);
CREATE INDEX idx_clients_contact_email ON clients(contact_email) WHERE contact_email IS NOT NULL;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at
CREATE TRIGGER update_clients_updated_at_trigger
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- Create function to validate status transitions
CREATE OR REPLACE FUNCTION validate_client_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to churned, ensure churn_date is set
  IF NEW.status = 'churned' AND OLD.status != 'churned' THEN
    IF NEW.churn_date IS NULL THEN
      NEW.churn_date = CURRENT_DATE;
    END IF;
  END IF;
  
  -- If status is changing away from churned, clear churn_date
  IF NEW.status != 'churned' AND OLD.status = 'churned' THEN
    NEW.churn_date = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status transition validation
CREATE TRIGGER validate_client_status_transition_trigger
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION validate_client_status_transition();

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view clients they own
CREATE POLICY "Users can view their own clients" ON clients
  FOR SELECT
  USING (owner_id = auth.uid());

-- Users can insert clients they own
CREATE POLICY "Users can insert their own clients" ON clients
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Users can update clients they own
CREATE POLICY "Users can update their own clients" ON clients
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete clients they own
CREATE POLICY "Users can delete their own clients" ON clients
  FOR DELETE
  USING (owner_id = auth.uid());

-- Admin users can view all clients
CREATE POLICY "Admins can view all clients" ON clients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admin users can manage all clients
CREATE POLICY "Admins can manage all clients" ON clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Create helpful comments
COMMENT ON TABLE clients IS 'Client subscription management with MRR tracking';
COMMENT ON COLUMN clients.company_name IS 'Client company name (required)';
COMMENT ON COLUMN clients.contact_name IS 'Primary contact name';
COMMENT ON COLUMN clients.contact_email IS 'Primary contact email';
COMMENT ON COLUMN clients.subscription_amount IS 'Monthly recurring revenue amount';
COMMENT ON COLUMN clients.status IS 'Client subscription status: active, churned, or paused';
COMMENT ON COLUMN clients.deal_id IS 'Optional reference to original deal that was converted';
COMMENT ON COLUMN clients.owner_id IS 'Sales rep who owns this client relationship';
COMMENT ON COLUMN clients.subscription_start_date IS 'Date when subscription started';
COMMENT ON COLUMN clients.churn_date IS 'Date when client churned (only when status is churned)';