/*
  # Add quantity field to activities

  1. Changes
    - Add quantity column to activities table
    - Set default value to 1
    - Update existing records
*/

-- Add quantity column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE activities ADD COLUMN quantity integer DEFAULT 1;
  END IF;
END $$;

-- Update existing activities to have quantity = 1 if null
UPDATE activities 
SET quantity = 1 
WHERE quantity IS NULL;

-- Make quantity NOT NULL after populating data
ALTER TABLE activities
  ALTER COLUMN quantity SET NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS activities_quantity_idx ON activities(quantity); 