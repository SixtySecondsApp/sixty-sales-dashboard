-- Create branding_settings table for custom logos and favicon
-- This table stores branding assets (logos, icons) for the application
-- Uses singleton pattern: only one row with constant ID
-- Application code should always use UPSERT with this ID
-- NOTE: Made conditional for staging compatibility

CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,

  -- Logo URLs
  logo_light_url TEXT,
  logo_dark_url TEXT,

  -- Icon URL (for favicon and collapsed menu)
  icon_url TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (created conditionally)
DO $$
BEGIN
  -- Allow authenticated users to read branding settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'branding_settings'
    AND policyname = 'Anyone can read branding settings'
  ) THEN
    CREATE POLICY "Anyone can read branding settings"
      ON branding_settings FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Only admins can insert/update branding settings (requires profiles table)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'branding_settings'
      AND policyname = 'Admins can manage branding settings'
    ) THEN
      CREATE POLICY "Admins can manage branding settings"
        ON branding_settings FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
          )
        );
    END IF;
  ELSE
    RAISE NOTICE 'Skipping admin policy for branding_settings - profiles table does not exist yet';
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branding_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS branding_settings_updated_at ON branding_settings;
CREATE TRIGGER branding_settings_updated_at
  BEFORE UPDATE ON branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_branding_settings_updated_at();

-- Insert default empty row (will be updated by admin via UPSERT)
-- Using ON CONFLICT to ensure only one row exists
INSERT INTO branding_settings (id, logo_light_url, logo_dark_url, icon_url)
VALUES ('00000000-0000-0000-0000-000000000000'::uuid, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
