-- Fix missing columns in api_keys table
-- This addresses the specific issue where is_active column doesn't exist

-- Add missing is_active column if it doesn't exist
DO $$ 
BEGIN
    -- Check if is_active column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'is_active'
        AND table_schema = 'public'
    ) THEN
        -- Add the missing column
        ALTER TABLE api_keys ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Added is_active column to api_keys table';
    ELSE
        RAISE NOTICE 'is_active column already exists';
    END IF;
    
    -- Check if updated_at column exists (might also be missing)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'updated_at'
        AND table_schema = 'public'
    ) THEN
        -- Add the missing column
        ALTER TABLE api_keys ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to api_keys table';
    ELSE
        RAISE NOTICE 'updated_at column already exists';
    END IF;
    
    -- Ensure the trigger function exists
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
    
    -- Ensure the trigger exists
    DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
    CREATE TRIGGER update_api_keys_updated_at 
        BEFORE UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    RAISE NOTICE 'Updated trigger function and trigger created';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error in column fix: %', SQLERRM;
END $$;