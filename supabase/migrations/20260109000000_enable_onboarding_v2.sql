-- Enable Onboarding V2 (Skills-based) for all environments
-- This migration sets the global feature flag for the new onboarding flow

INSERT INTO app_settings (key, value, description)
VALUES (
  'onboarding_version',
  'v2',
  'Onboarding version: v1 (legacy) or v2 (skills-based)'
)
ON CONFLICT (key)
DO UPDATE SET
  value = 'v2';
