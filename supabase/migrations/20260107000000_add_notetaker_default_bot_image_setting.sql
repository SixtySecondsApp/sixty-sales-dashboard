-- ============================================================================
-- Add Platform-Controlled Default Bot Image Setting
-- ============================================================================
-- Purpose: 
-- 1. Seed app_settings with platform-wide default bot image URL
-- 2. Clear org-level overrides that were set to the old default (Icon.png)
--    so platform defaults take effect
-- ============================================================================

-- Insert platform default bot image URL (upsert to avoid duplicates)
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'notetaker_default_bot_image_url',
  'https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/60-notetaker.jpg',
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = NOW()
WHERE app_settings.value != EXCLUDED.value;

-- Clear org-level bot_image_url when it equals the old default (Icon.png)
-- This allows platform defaults to take effect for these orgs
UPDATE organizations
SET recording_settings = jsonb_set(
  recording_settings,
  '{bot_image_url}',
  'null'::jsonb
)
WHERE 
  recording_settings->>'bot_image_url' = 'https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/Icon.png';

-- Add comment for documentation
COMMENT ON TABLE app_settings IS 'Application-wide configuration settings (key-value store). Includes platform defaults for MeetingBaaS bot branding.';

-- ============================================================================
-- Notify completion
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Platform default bot image setting added';
  RAISE NOTICE '  - app_settings.notetaker_default_bot_image_url seeded';
  RAISE NOTICE '  - Org-level Icon.png overrides cleared';
END $$;
