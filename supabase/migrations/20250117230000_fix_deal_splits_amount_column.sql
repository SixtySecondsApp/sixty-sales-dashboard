/*
  # Fix Deal Splits Amount Column
  
  This migration fixes the issue with the generated column in deal_splits
  that was trying to use a subquery, which PostgreSQL doesn't allow.
  
  1. Drop the generated column
  2. Add a regular amount column
  3. Create triggers to calculate and update amounts
*/

-- Drop the table and recreate it without the problematic generated column
DROP TABLE IF EXISTS deal_splits CASCADE;

-- Recreate deal_splits table without generated column
CREATE TABLE deal_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique combination of deal and user
  UNIQUE(deal_id, user_id)
);

-- Create function to calculate split amount
CREATE OR REPLACE FUNCTION calculate_split_amount(p_deal_id UUID, p_percentage DECIMAL)
RETURNS DECIMAL AS $$
DECLARE
  deal_value DECIMAL(12,2);
BEGIN
  SELECT value INTO deal_value FROM deals WHERE id = p_deal_id;
  RETURN COALESCE(deal_value, 0) * (p_percentage / 100);
END;
$$ LANGUAGE plpgsql;

-- Create function to update split amount on insert/update
CREATE OR REPLACE FUNCTION update_split_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount := calculate_split_amount(NEW.deal_id, NEW.percentage);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate amount on insert/update
DROP TRIGGER IF EXISTS calculate_split_amount_trigger ON deal_splits;
CREATE TRIGGER calculate_split_amount_trigger
  BEFORE INSERT OR UPDATE ON deal_splits
  FOR EACH ROW
  EXECUTE FUNCTION update_split_amount();

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
CREATE OR REPLACE FUNCTION update_deal_split_amounts_on_deal_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all split amounts for this deal when deal value changes
  UPDATE deal_splits 
  SET amount = calculate_split_amount(NEW.id, percentage),
      updated_at = NOW()
  WHERE deal_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update split amounts when deal value changes
DROP TRIGGER IF EXISTS update_split_amounts_on_deal_change_trigger ON deals;
CREATE TRIGGER update_split_amounts_on_deal_change_trigger
  AFTER UPDATE OF value ON deals
  FOR EACH ROW
  WHEN (OLD.value IS DISTINCT FROM NEW.value)
  EXECUTE FUNCTION update_deal_split_amounts_on_deal_change();

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

-- Recreate the view for easier querying of deal splits with user info
DROP VIEW IF EXISTS deal_splits_with_users;
CREATE VIEW deal_splits_with_users AS
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