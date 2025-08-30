-- First, let's see what columns currently exist in the api_keys table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;

-- Add missing columns one by one with proper checks
DO $$ 
BEGIN
    -- Add created_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add key_preview if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'key_preview'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN key_preview TEXT;
    END IF;

    -- Add usage_count if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'usage_count'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN usage_count INTEGER DEFAULT 0;
    END IF;

    -- Add last_used if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'last_used'
    ) THEN
        ALTER TABLE api_keys ADD COLUMN last_used TIMESTAMPTZ;
    END IF;
END $$;

-- Update any existing rows that might have NULL key_preview
UPDATE api_keys 
SET key_preview = COALESCE(
    key_preview,
    CASE 
        WHEN key_hash IS NOT NULL THEN 
            SUBSTR(key_hash, 1, 8) || '...' || SUBSTR(key_hash, LENGTH(key_hash) - 3, 4)
        ELSE 'preview_unavailable'
    END
)
WHERE key_preview IS NULL;

-- Try to make key_preview NOT NULL (will fail if there are still NULLs)
DO $$ 
BEGIN
    ALTER TABLE api_keys ALTER COLUMN key_preview SET NOT NULL;
EXCEPTION
    WHEN OTHERS THEN
        -- If it fails, update all NULLs first
        UPDATE api_keys SET key_preview = 'preview_unavailable' WHERE key_preview IS NULL;
        ALTER TABLE api_keys ALTER COLUMN key_preview SET NOT NULL;
END $$;

-- Create indexes safely
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_keys' AND indexname = 'idx_api_keys_user_id'
    ) THEN
        CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_keys' AND indexname = 'idx_api_keys_key_hash'
    ) THEN
        CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
    END IF;

    -- Only create created_at index if the column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_keys' AND column_name = 'created_at'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_keys' AND indexname = 'idx_api_keys_created_at'
    ) THEN
        CREATE INDEX idx_api_keys_created_at ON api_keys(created_at DESC);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;

-- Create new policies
CREATE POLICY "Users can view their own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_keys TO service_role;

-- Create api_key_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for usage table safely
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_key_usage' AND indexname = 'idx_api_key_usage_api_key_id'
    ) THEN
        CREATE INDEX idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'api_key_usage' AND indexname = 'idx_api_key_usage_created_at'
    ) THEN
        CREATE INDEX idx_api_key_usage_created_at ON api_key_usage(created_at DESC);
    END IF;
END $$;

-- Enable RLS on usage table
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Drop and recreate usage policy
DROP POLICY IF EXISTS "Users can view usage for their API keys" ON api_key_usage;

CREATE POLICY "Users can view usage for their API keys"
  ON api_key_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = api_key_usage.api_key_id
      AND api_keys.user_id = auth.uid()
    )
  );

-- Grant permissions for usage table
GRANT ALL ON api_key_usage TO authenticated;
GRANT ALL ON api_key_usage TO service_role;

-- Finally, show the updated structure
SELECT 
    'api_keys table structure after fixes:' as info;
    
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;