-- Check if the api_keys table exists and add missing columns
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_preview TEXT;

ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ;

-- Update any existing rows that might have NULL key_preview
UPDATE api_keys 
SET key_preview = CASE 
    WHEN key_hash IS NOT NULL THEN 
        SUBSTR(key_hash, 1, 8) || '...' || SUBSTR(key_hash, LENGTH(key_hash) - 3, 4)
    ELSE 'preview_unavailable'
END
WHERE key_preview IS NULL;

-- Make key_preview NOT NULL after updating existing rows
ALTER TABLE api_keys 
ALTER COLUMN key_preview SET NOT NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at DESC);

-- Enable RLS if not already enabled
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;

-- Create RLS policies
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

-- Create indexes for usage table
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at DESC);

-- Enable RLS on usage table
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Drop and recreate usage policies
DROP POLICY IF EXISTS "Users can view usage for their API keys" ON api_key_usage;

-- Usage policies
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

-- Show the current structure of the api_keys table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;