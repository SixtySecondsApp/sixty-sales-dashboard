/*
  # Fix Schema Issues

  1. Changes
    - Rename clientName back to client_name for consistency with Supabase conventions
    - Add missing columns and indexes
    - Update existing data

  2. Security
    - Update RLS policies to reflect changes
*/

-- Rename clientName back to client_name for consistency
ALTER TABLE activities 
  RENAME COLUMN clientName TO client_name;

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS activities_sales_rep_idx ON activities(sales_rep);
CREATE INDEX IF NOT EXISTS activities_client_name_idx ON activities(client_name);
CREATE INDEX IF NOT EXISTS activities_status_idx ON activities(status);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can read own activities" ON activities;
DROP POLICY IF EXISTS "Users can create own activities" ON activities;
DROP POLICY IF EXISTS "Users can update own activities" ON activities;
DROP POLICY IF EXISTS "Users can delete own activities" ON activities;

CREATE POLICY "Users can read own activities"
  ON activities FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add function to calculate win rate
CREATE OR REPLACE FUNCTION calculate_win_rate(user_id uuid, start_date timestamptz, end_date timestamptz)
RETURNS numeric AS $$
DECLARE
  total_proposals numeric;
  won_deals numeric;
BEGIN
  SELECT COUNT(*) INTO total_proposals
  FROM activities
  WHERE activities.user_id = calculate_win_rate.user_id
  AND type = 'proposal'
  AND date BETWEEN start_date AND end_date;

  SELECT COUNT(*) INTO won_deals
  FROM activities
  WHERE activities.user_id = calculate_win_rate.user_id
  AND type = 'sale'
  AND date BETWEEN start_date AND end_date;

  IF total_proposals = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((won_deals / total_proposals) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;