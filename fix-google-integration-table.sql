-- Fix google_integrations table schema
-- Add missing columns if they don't exist

-- Add token_expires_at column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'google_integrations' 
        AND column_name = 'token_expires_at'
    ) THEN
        ALTER TABLE google_integrations 
        ADD COLUMN token_expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add scope column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'google_integrations' 
        AND column_name = 'scope'
    ) THEN
        ALTER TABLE google_integrations 
        ADD COLUMN scope TEXT;
    END IF;
END $$;

-- Show current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'google_integrations' 
ORDER BY ordinal_position;