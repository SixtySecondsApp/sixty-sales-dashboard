-- Update bot profile image URL for existing organizations
-- Sets bot_image_url to Icon.png (profile picture alongside name)
-- Note: DEFAULT_BOT_IMAGE in edge functions uses 60-notetaker.jpg as fallback

UPDATE organizations
SET recording_settings = jsonb_set(
  recording_settings,
  '{bot_image_url}',
  '"https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/Icon.png"'
)
WHERE
  recording_settings->>'bot_image_url' IS NULL
  OR recording_settings->>'bot_image_url' = 'https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/60-notetaker.jpg';
