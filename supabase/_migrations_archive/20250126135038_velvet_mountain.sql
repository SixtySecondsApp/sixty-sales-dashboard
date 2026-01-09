/*
  # Add sales_rep column to activities table

  1. Changes
    - Add sales_rep column to activities table
    - Update existing activities with sales rep names
    - Make sales_rep column NOT NULL
    - Add index for better performance

  2. Security
    - No changes to RLS policies needed
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

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS activities_sales_rep_idx ON activities(sales_rep);