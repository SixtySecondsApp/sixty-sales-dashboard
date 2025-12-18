-- ============================================================================
-- Migration: Add org currency + company profile/enrichment fields
-- ============================================================================
-- Purpose:
-- - Store organization-level currency + locale preferences
-- - Store organization-level company profile fields (domain, website, bio, etc.)
-- - Store enrichment status + raw payload for Gemini enrichment
-- - Add user bio field on profiles for AI personalization context
--
-- Notes:
-- - We intentionally do NOT convert any existing numeric deal values.
-- - Currency fields are display preferences only.
-- - RLS policies for organizations/profiles already exist; adding columns does not change policy logic.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN IF NOT EXISTS currency_locale TEXT NOT NULL DEFAULT 'en-GB',
ADD COLUMN IF NOT EXISTS company_domain TEXT NULL,
ADD COLUMN IF NOT EXISTS company_website TEXT NULL,
ADD COLUMN IF NOT EXISTS company_country_code TEXT NULL,
ADD COLUMN IF NOT EXISTS company_timezone TEXT NULL,
ADD COLUMN IF NOT EXISTS company_industry TEXT NULL,
ADD COLUMN IF NOT EXISTS company_size TEXT NULL,
ADD COLUMN IF NOT EXISTS company_bio TEXT NULL,
ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT NULL,
ADD COLUMN IF NOT EXISTS company_enrichment_status TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS company_enriched_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS company_enrichment_confidence NUMERIC NULL,
ADD COLUMN IF NOT EXISTS company_enrichment_raw JSONB NULL;

-- Basic guardrails
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_currency_code_not_empty;
ALTER TABLE organizations
ADD CONSTRAINT organizations_currency_code_not_empty CHECK (length(trim(currency_code)) > 0);

ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_currency_locale_not_empty;
ALTER TABLE organizations
ADD CONSTRAINT organizations_currency_locale_not_empty CHECK (length(trim(currency_locale)) > 0);

ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_company_enrichment_status_valid;
ALTER TABLE organizations
ADD CONSTRAINT organizations_company_enrichment_status_valid
CHECK (company_enrichment_status IN ('not_started', 'pending', 'completed', 'failed'));

-- Indexes (lightweight; for admin/settings + enrichment lookups)
CREATE INDEX IF NOT EXISTS idx_organizations_company_domain ON organizations(company_domain);
CREATE INDEX IF NOT EXISTS idx_organizations_company_enrichment_status ON organizations(company_enrichment_status);

COMMENT ON COLUMN organizations.currency_code IS 'ISO 4217 currency code for org-wide money display (display preference only).';
COMMENT ON COLUMN organizations.currency_locale IS 'Locale for org-wide money formatting (e.g., en-GB).';
COMMENT ON COLUMN organizations.company_domain IS 'Primary email/web domain for the organization (used for enrichment).';
COMMENT ON COLUMN organizations.company_bio IS 'AI-generated or human-edited company bio for org context.';
COMMENT ON COLUMN organizations.company_enrichment_status IS 'Org enrichment state: not_started|pending|completed|failed.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT NULL;

COMMENT ON COLUMN profiles.bio IS 'Optional user bio used to personalize AI responses.';





