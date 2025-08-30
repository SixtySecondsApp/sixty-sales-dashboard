-- Fix for missing expected_close_date column in deals table
-- Run this in the Supabase SQL Editor

-- First, check if the column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deals' AND column_name = 'expected_close_date'
    ) THEN
        -- Add the missing column
        ALTER TABLE deals ADD COLUMN expected_close_date DATE;
        RAISE NOTICE 'Added expected_close_date column to deals table';
        
        -- Create an index for performance
        CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date 
        ON deals(expected_close_date) 
        WHERE expected_close_date IS NOT NULL;
        
        RAISE NOTICE 'Created index on expected_close_date column';
    ELSE
        RAISE NOTICE 'expected_close_date column already exists';
    END IF;
END $$;

-- Update the comment to refresh schema cache
COMMENT ON COLUMN deals.expected_close_date IS 'Expected date when the deal will close';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'deals' AND column_name = 'expected_close_date'; 