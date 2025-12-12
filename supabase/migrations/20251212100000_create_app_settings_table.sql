-- ============================================================================
-- Create app_settings table
-- ============================================================================
-- Purpose: This table stores application-wide configuration settings.
-- Multiple migrations reference this table for RLS policies but it was never created.
-- ============================================================================

-- Create the app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add a comment describing the table
COMMENT ON TABLE app_settings IS 'Application-wide configuration settings (key-value store)';
COMMENT ON COLUMN app_settings.key IS 'Unique setting key/name';
COMMENT ON COLUMN app_settings.value IS 'Setting value stored as text (can be JSON for complex values)';
COMMENT ON COLUMN app_settings.updated_at IS 'Timestamp of last update';

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at);

-- Enable Row Level Security
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can read non-secret settings
DROP POLICY IF EXISTS "app_settings_authenticated_read" ON app_settings;
CREATE POLICY "app_settings_authenticated_read" ON app_settings
  FOR SELECT TO authenticated 
  USING (key NOT LIKE 'secret_%');

-- Admin users can manage all settings
DROP POLICY IF EXISTS "app_settings_admin_all" ON app_settings;
CREATE POLICY "app_settings_admin_all" ON app_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS app_settings_updated_at_trigger ON app_settings;
CREATE TRIGGER app_settings_updated_at_trigger
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_updated_at();

-- ============================================================================
-- Notify completion
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ app_settings table created successfully';
  RAISE NOTICE '  - Table with key/value/updated_at columns';
  RAISE NOTICE '  - RLS enabled with authenticated read and admin write';
  RAISE NOTICE '  - Auto-update trigger for updated_at';
END $$;

