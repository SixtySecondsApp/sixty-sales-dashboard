/*
  # Add Deal Splits functionality
  
  This migration creates the deal_splits table to allow deals to be split
  between multiple team members with different percentage allocations.
  
  1. Creates deal_splits table with:
     - deal_id (references deals table)
     - user_id (references profiles table)
     - percentage (decimal between 0 and 100)
     - amount (calculated field based on deal value * percentage)
     - created_at, updated_at timestamps
  
  2. Adds constraints to ensure:
     - Percentages are between 0 and 100
     - Total percentages for a deal don't exceed 100
  
  3. Creates indexes for performance
  4. Sets up RLS policies for security
*/

-- Create deal_splits table
CREATE TABLE IF NOT EXISTS deal_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  amount DECIMAL(12,2) GENERATED ALWAYS AS (
    CASE 
      WHEN percentage > 0 THEN
        (SELECT value FROM deals WHERE id = deal_id) * (percentage / 100)
      ELSE 0
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of deal and user
  UNIQUE(deal_id, user_id)
);

-- Create function to validate total percentages don't exceed 100%
CREATE OR REPLACE FUNCTION validate_deal_split_percentages()
RETURNS TRIGGER AS $$
DECLARE
  total_percentage DECIMAL(5,2);
BEGIN
  -- Calculate total percentage for this deal (excluding the current row if updating)
  SELECT COALESCE(SUM(percentage), 0) INTO total_percentage
  FROM deal_splits 
  WHERE deal_id = NEW.deal_id 
    AND (TG_OP = 'INSERT' OR id != NEW.id);
  
  -- Add the new/updated percentage
  total_percentage := total_percentage + NEW.percentage;
  
  -- Check if total exceeds 100%
  IF total_percentage > 100 THEN
    RAISE EXCEPTION 'Total split percentages cannot exceed 100%%. Current total would be: %', total_percentage;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate percentages
DROP TRIGGER IF EXISTS validate_deal_splits_trigger ON deal_splits;
CREATE TRIGGER validate_deal_splits_trigger
  BEFORE INSERT OR UPDATE ON deal_splits
  FOR EACH ROW
  EXECUTE FUNCTION validate_deal_split_percentages();

-- Create function to update split amounts when deal value changes
CREATE OR REPLACE FUNCTION update_deal_split_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all split amounts for this deal when deal value changes
  UPDATE deal_splits 
  SET updated_at = NOW()
  WHERE deal_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update split amounts when deal value changes
DROP TRIGGER IF EXISTS update_split_amounts_trigger ON deals;
CREATE TRIGGER update_split_amounts_trigger
  AFTER UPDATE OF value ON deals
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION update_deal_split_amounts();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_deal_splits_updated_at ON deal_splits;
CREATE TRIGGER update_deal_splits_updated_at
    BEFORE UPDATE ON deal_splits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deal_splits_deal_id ON deal_splits(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_splits_user_id ON deal_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_splits_created_at ON deal_splits(created_at);

-- Enable RLS
ALTER TABLE deal_splits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view splits for deals they own or splits assigned to them
DROP POLICY IF EXISTS "Users can view relevant deal splits" ON deal_splits;
CREATE POLICY "Users can view relevant deal splits" ON deal_splits FOR SELECT USING (
  user_id = auth.uid() OR 
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Users can create splits for their own deals
DROP POLICY IF EXISTS "Users can create splits for own deals" ON deal_splits;
CREATE POLICY "Users can create splits for own deals" ON deal_splits FOR INSERT WITH CHECK (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Users can update splits for their own deals
DROP POLICY IF EXISTS "Users can update splits for own deals" ON deal_splits;
CREATE POLICY "Users can update splits for own deals" ON deal_splits FOR UPDATE USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Users can delete splits for their own deals
DROP POLICY IF EXISTS "Users can delete splits for own deals" ON deal_splits;
CREATE POLICY "Users can delete splits for own deals" ON deal_splits FOR DELETE USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid())
);

-- Create a view for easier querying of deal splits with user info
CREATE OR REPLACE VIEW deal_splits_with_users AS
SELECT 
  ds.*,
  p.first_name,
  p.last_name,
  p.email,
  (p.first_name || ' ' || p.last_name) as full_name,
  d.name as deal_name,
  d.value as deal_value,
  d.owner_id as deal_owner_id
FROM deal_splits ds
JOIN profiles p ON ds.user_id = p.id
JOIN deals d ON ds.deal_id = d.id;

-- Grant access to the view
GRANT SELECT ON deal_splits_with_users TO authenticated; 