-- ============================================================================
-- Add Task Auto-Sync Preferences to User Settings
-- ============================================================================
-- Purpose: Enable user-controlled auto-sync configuration for task creation
--          from action items based on importance levels
-- ============================================================================

-- Ensure user_settings table exists with preferences JSONB column
-- (This table should already exist, but verify)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_settings') THEN
    CREATE TABLE user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
      preferences JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    COMMENT ON TABLE user_settings IS 'User-specific settings and preferences';
    COMMENT ON COLUMN user_settings.preferences IS 'JSONB field for flexible user preferences storage';

    -- Create index for user_id lookup
    CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

    RAISE NOTICE 'Created user_settings table';
  ELSE
    -- Ensure preferences column exists
    IF NOT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'user_settings' AND column_name = 'preferences'
    ) THEN
      ALTER TABLE user_settings ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
      RAISE NOTICE 'Added preferences column to user_settings table';
    END IF;
  END IF;
END $$;

-- Add default task auto-sync preferences for existing users
-- Only update users who don't already have task_auto_sync preferences
UPDATE user_settings
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{
  "task_auto_sync": {
    "enabled": false,
    "importance_levels": ["high"],
    "confidence_threshold": 0.8
  }
}'::jsonb,
updated_at = NOW()
WHERE preferences IS NULL OR preferences->'task_auto_sync' IS NULL;

-- Create GIN index for faster JSONB lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_preferences ON user_settings USING gin(preferences);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Count users with auto-sync preferences
DO $$
DECLARE
  total_users INTEGER;
  users_with_prefs INTEGER;
  users_enabled INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM user_settings;
  SELECT COUNT(*) INTO users_with_prefs FROM user_settings WHERE preferences->'task_auto_sync' IS NOT NULL;
  SELECT COUNT(*) INTO users_enabled FROM user_settings WHERE (preferences->'task_auto_sync'->>'enabled')::boolean = true;

  RAISE NOTICE 'User settings: Total=%, With auto-sync prefs=%, Enabled=%',
    total_users, users_with_prefs, users_enabled;
END $$;

-- ============================================================================
-- Sample Preferences Schema (for documentation)
-- ============================================================================
-- preferences: {
--   task_auto_sync: {
--     enabled: boolean              // Enable/disable auto-sync
--     importance_levels: string[]   // ['high'] or ['high', 'medium'] or ['high', 'medium', 'low']
--     confidence_threshold: number  // 0.7 to 1.0 (default 0.8)
--   }
-- }
-- ============================================================================
