-- Add api_name column to booking_sources for programmatic access
-- This provides a stable, API-friendly identifier (e.g., "facebook_ads" instead of "Facebook Ads 📘")

-- Add api_name column
ALTER TABLE booking_sources 
ADD COLUMN IF NOT EXISTS api_name TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_booking_sources_api_name 
ON booking_sources(api_name) WHERE api_name IS NOT NULL;

-- Populate api_name for existing sources based on their names
UPDATE booking_sources 
SET api_name = CASE name
  WHEN 'Facebook Ads' THEN 'facebook_ads'
  WHEN 'LinkedIn Ads' THEN 'linkedin_ads'
  WHEN 'Google Ads' THEN 'google_ads'
  WHEN 'Website' THEN 'website'
  WHEN 'Organic Search' THEN 'organic_search'
  WHEN 'Referral' THEN 'referral'
  WHEN 'Email Campaign' THEN 'email_campaign'
  WHEN 'Content Marketing' THEN 'content_marketing'
  WHEN 'Social Media' THEN 'social_media'
  WHEN 'Webinar' THEN 'webinar'
  WHEN 'Event' THEN 'event'
  WHEN 'Partner' THEN 'partner'
  WHEN 'Cold Outreach' THEN 'cold_outreach'
  WHEN 'Unknown' THEN 'unknown'
  WHEN 'Client Call' THEN 'client_call'
  WHEN 'Personal Link' THEN 'personal_link'
  ELSE LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g'))
END
WHERE api_name IS NULL;

-- Make api_name required after populating all existing records
-- Only set NOT NULL if all records have api_name
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM booking_sources WHERE api_name IS NULL) THEN
    ALTER TABLE booking_sources ALTER COLUMN api_name SET NOT NULL;
    RAISE NOTICE 'Set api_name to NOT NULL';
  ELSE
    RAISE NOTICE 'Some records still have NULL api_name. Please populate them before setting NOT NULL.';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN booking_sources.api_name IS 'API-friendly identifier for programmatic access (e.g., "facebook_ads", "linkedin_ads"). Must be unique and stable.';

