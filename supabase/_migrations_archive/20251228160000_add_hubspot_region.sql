-- ============================================================================
-- Migration: Add HubSpot Region Support
-- ============================================================================
-- Purpose:
-- - Add hubspot_region column to store the HubSpot datacenter region
-- - Regions: 'eu1' for EU datacenter, 'na1' for US/North America
-- - This is needed to generate correct URLs for viewing HubSpot records
-- ============================================================================

-- Add region column to hubspot_org_integrations
ALTER TABLE public.hubspot_org_integrations
ADD COLUMN IF NOT EXISTS hubspot_region text DEFAULT 'eu1';

-- Add comment for documentation
COMMENT ON COLUMN public.hubspot_org_integrations.hubspot_region IS
  'HubSpot datacenter region: eu1 for EU, na1 for US/NA. Used to generate correct view URLs.';
