-- Add api_name column to booking_sources for programmatic access
-- Run this in Supabase SQL Editor to add the column and populate existing records

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

-- Make api_name required for new records (but allow NULL for now to handle existing data)
-- You can run this after verifying all records have api_name:
-- ALTER TABLE booking_sources ALTER COLUMN api_name SET NOT NULL;

-- Add comment
COMMENT ON COLUMN booking_sources.api_name IS 'API-friendly identifier for programmatic access (e.g., "facebook_ads", "linkedin_ads"). Must be unique and stable.';

-- Verify the update
SELECT name, api_name, category 
FROM booking_sources 
ORDER BY sort_order, name;







