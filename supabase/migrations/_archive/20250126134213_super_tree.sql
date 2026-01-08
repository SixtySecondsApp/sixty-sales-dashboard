/*
  # Fix Activities Schema

  1. Changes
    - Add sales_rep column to activities table
    - Update existing activities with sales rep names
    - Add missing indexes
    - Update RLS policies

  2. Security
    - Maintain existing RLS policies
    - Add index for sales_rep column
*/

-- Add sales_rep column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'sales_rep'
  ) THEN
    ALTER TABLE activities ADD COLUMN sales_rep text;
  END IF;
END $$;

-- Update existing activities to include sales rep name
UPDATE activities a
SET sales_rep = p.first_name || ' ' || p.last_name
FROM profiles p
WHERE a.user_id = p.id
AND a.sales_rep IS NULL;

-- Make sales_rep NOT NULL after populating data
ALTER TABLE activities
  ALTER COLUMN sales_rep SET NOT NULL;

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS activities_sales_rep_idx ON activities(sales_rep);
CREATE INDEX IF NOT EXISTS activities_client_name_idx ON activities(client_name);
CREATE INDEX IF NOT EXISTS activities_status_idx ON activities(status);
CREATE INDEX IF NOT EXISTS activities_date_idx ON activities(date);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(type);
CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);

-- Update RLS policies to ensure they work with all columns
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