-- Add a flexible preferences column to user_settings for per-user feature toggles
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_settings.preferences IS 'Arbitrary user preferences JSON, e.g., {"auto_fathom_activity": {"enabled": true, "from_date": "YYYY-MM-DD"}}';

-- Helpful index for querying preference keys (optional, lightweight)
CREATE INDEX IF NOT EXISTS idx_user_settings_preferences_gin
  ON user_settings
  USING GIN (preferences);


