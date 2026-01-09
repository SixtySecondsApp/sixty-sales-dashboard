/*
  # Fix Schema Issues

  1. Changes
    - Add sales_rep column to activities table
    - Rename client_name to clientName for consistency
    - Add missing indexes for performance

  2. Security
    - Update RLS policies to include new columns
*/

-- Rename client_name to clientName and add sales_rep column
ALTER TABLE activities 
  RENAME COLUMN client_name TO clientName;

ALTER TABLE activities 
  ADD COLUMN sales_rep text;

-- Update existing activities to include sales rep name
UPDATE activities a
SET sales_rep = p.first_name || ' ' || p.last_name
FROM profiles p
WHERE a.user_id = p.id;

-- Make sales_rep NOT NULL after populating data
ALTER TABLE activities
  ALTER COLUMN sales_rep SET NOT NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS activities_date_idx ON activities(date);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities(type);
CREATE INDEX IF NOT EXISTS activities_user_id_idx ON activities(user_id);

-- Update RLS policies to ensure they work with renamed columns
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