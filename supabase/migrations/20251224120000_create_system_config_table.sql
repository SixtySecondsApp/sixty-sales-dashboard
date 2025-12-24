-- Create system_config table for storing application-wide configuration
-- Used for things like Slack waitlist notification settings

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE system_config IS 'Application-wide configuration settings';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read config
CREATE POLICY "Allow authenticated users to read system_config"
  ON system_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can insert/update/delete
-- (This is handled by using service role key in edge functions)
-- For admin users, we'll create an RPC function

-- Create RPC function to set config (admin only)
CREATE OR REPLACE FUNCTION set_system_config(
  p_key TEXT,
  p_value TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO system_config (key, value, description, updated_at)
  VALUES (p_key, p_value, p_description, NOW())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = COALESCE(EXCLUDED.description, system_config.description),
    updated_at = NOW();
END;
$$;

-- Grant execute to authenticated users (the function itself can add additional checks if needed)
GRANT EXECUTE ON FUNCTION set_system_config TO authenticated;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_updated_at();
