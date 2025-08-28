-- Add missing is_active column to api_keys table
-- Run this in Supabase Dashboard > SQL Editor

-- Add the missing column
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
  AND table_schema = 'public'
  AND column_name = 'is_active';

-- Show success message
SELECT 'SUCCESS: is_active column added to api_keys table' AS result;