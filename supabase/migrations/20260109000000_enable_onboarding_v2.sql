-- Enable Onboarding V2 (Skills-based) for all environments
-- This migration sets the global feature flag for the new onboarding flow

INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES (
  'onboarding_version',
  'v2',
  'Onboarding version: v1 (legacy) or v2 (skills-based)',
  NOW(),
  NOW()
)
ON CONFLICT (key)
DO UPDATE SET
  value = 'v2',
  updated_at = NOW();
