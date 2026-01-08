-- Fix google_integrations table schema
-- Add missing columns for proper Google OAuth token management

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
        
        -- Set a default expiration for existing tokens (1 hour from now)
        UPDATE google_integrations 
        SET token_expires_at = NOW() + INTERVAL '1 hour'
        WHERE token_expires_at IS NULL;
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
        ADD COLUMN scope TEXT DEFAULT 'https://www.googleapis.com/auth/documents';
        
        -- Set default scope for existing integrations
        UPDATE google_integrations 
        SET scope = 'https://www.googleapis.com/auth/documents'
        WHERE scope IS NULL;
    END IF;
END $$;