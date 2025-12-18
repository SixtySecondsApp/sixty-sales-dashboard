-- ============================================================================
-- Migration: Add public_key/private_key columns to savvycal_integration_secrets
-- ============================================================================
-- SavvyCal uses Public Key + Private Key authentication, not a single token.
-- This migration adds the new columns if they don't exist.
-- ============================================================================

-- Add new columns for public/private key auth
DO $$
BEGIN
  -- Add api_public_key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'savvycal_integration_secrets' 
    AND column_name = 'api_public_key'
  ) THEN
    ALTER TABLE public.savvycal_integration_secrets 
    ADD COLUMN api_public_key text;
  END IF;

  -- Add api_private_key if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'savvycal_integration_secrets' 
    AND column_name = 'api_private_key'
  ) THEN
    ALTER TABLE public.savvycal_integration_secrets 
    ADD COLUMN api_private_key text;
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN public.savvycal_integration_secrets.api_public_key IS 'SavvyCal Public Key (pk_...).';
COMMENT ON COLUMN public.savvycal_integration_secrets.api_private_key IS 'SavvyCal Private Key (sk_...).';
COMMENT ON COLUMN public.savvycal_integration_secrets.api_token IS 'Legacy: single token field (deprecated, use api_public_key/api_private_key).';






