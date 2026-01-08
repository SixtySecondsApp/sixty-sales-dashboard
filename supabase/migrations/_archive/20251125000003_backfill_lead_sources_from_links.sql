-- Backfill lead sources from SavvyCal link mappings
-- This updates leads that have a booking_link_id but no source tracking

--------------------------------------------------------------------------------
-- Step 1: Update leads that have booking_link_id but missing source info
--------------------------------------------------------------------------------
UPDATE leads l
SET
  source_channel = COALESCE(l.source_channel, slm.channel),
  source_medium = COALESCE(l.source_medium, slm.medium),
  utm_medium = COALESCE(l.utm_medium, slm.medium),
  updated_at = NOW()
FROM savvycal_link_mappings slm
WHERE l.booking_link_id = slm.link_id
  AND l.source_channel IS NULL
  AND l.utm_source IS NULL;

--------------------------------------------------------------------------------
-- Step 2: Update leads with UTM data to have proper source_channel
--------------------------------------------------------------------------------

-- Facebook/Instagram leads
UPDATE leads
SET
  source_channel = 'paid_social',
  source_medium = COALESCE(source_medium, 'meta'),
  updated_at = NOW()
WHERE (LOWER(utm_source) IN ('fb', 'facebook', 'ig', 'instagram'))
  AND source_channel IS NULL;

-- LinkedIn leads
UPDATE leads
SET
  source_channel = 'paid_social',
  source_medium = COALESCE(source_medium, 'linkedin'),
  updated_at = NOW()
WHERE LOWER(utm_source) = 'linkedin'
  AND source_channel IS NULL;

-- Google Ads leads
UPDATE leads
SET
  source_channel = CASE
    WHEN LOWER(utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'paid_search'
    ELSE 'organic'
  END,
  source_medium = COALESCE(source_medium, 'google'),
  updated_at = NOW()
WHERE LOWER(utm_source) = 'google'
  AND source_channel IS NULL;

-- Email leads
UPDATE leads
SET
  source_channel = 'email',
  source_medium = COALESCE(source_medium, 'email'),
  updated_at = NOW()
WHERE LOWER(utm_source) IN ('email', 'outreach', 'mail')
  AND source_channel IS NULL;

--------------------------------------------------------------------------------
-- Step 3: Create/update lead_sources entries based on UTM patterns
--------------------------------------------------------------------------------

-- Insert lead sources for unique UTM patterns found in leads
INSERT INTO lead_sources (source_key, name, channel, utm_source, utm_medium, utm_campaign)
SELECT DISTINCT
  CASE
    WHEN LOWER(l.utm_source) IN ('fb', 'facebook') THEN 'facebook_ads'
    WHEN LOWER(l.utm_source) = 'ig' OR LOWER(l.utm_source) = 'instagram' THEN 'instagram_ads'
    WHEN LOWER(l.utm_source) = 'linkedin' THEN 'linkedin_ads'
    WHEN LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'google_ads'
    WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'email_outreach'
    ELSE LOWER(REGEXP_REPLACE(COALESCE(l.utm_source, 'unknown'), '[^a-z0-9]', '_', 'g'))
  END AS source_key,
  CASE
    WHEN LOWER(l.utm_source) IN ('fb', 'facebook') THEN 'Facebook Ads'
    WHEN LOWER(l.utm_source) = 'ig' OR LOWER(l.utm_source) = 'instagram' THEN 'Instagram Ads'
    WHEN LOWER(l.utm_source) = 'linkedin' THEN 'LinkedIn Ads'
    WHEN LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'Google Ads'
    WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'Email Outreach'
    ELSE INITCAP(COALESCE(l.utm_source, 'Unknown'))
  END AS name,
  CASE
    WHEN LOWER(l.utm_source) IN ('fb', 'facebook', 'ig', 'instagram', 'linkedin') THEN 'paid_social'
    WHEN LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'paid_search'
    WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'email'
    ELSE 'other'
  END AS channel,
  CASE
    WHEN LOWER(l.utm_source) IN ('fb', 'facebook', 'ig', 'instagram') THEN 'meta'
    ELSE l.utm_source
  END AS utm_source,
  l.utm_medium,
  l.utm_campaign
FROM leads l
WHERE l.utm_source IS NOT NULL
  AND l.source_id IS NULL
ON CONFLICT (source_key) DO NOTHING;

--------------------------------------------------------------------------------
-- Step 4: Link leads to lead_sources entries
--------------------------------------------------------------------------------
UPDATE leads l
SET
  source_id = ls.id,
  updated_at = NOW()
FROM lead_sources ls
WHERE l.source_id IS NULL
  AND l.utm_source IS NOT NULL
  AND (
    -- Match exact UTM source
    (LOWER(l.utm_source) IN ('fb', 'facebook') AND ls.source_key = 'facebook_ads')
    OR (LOWER(l.utm_source) IN ('ig', 'instagram') AND ls.source_key = 'instagram_ads')
    OR (LOWER(l.utm_source) = 'linkedin' AND ls.source_key = 'linkedin_ads')
    OR (LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') AND ls.source_key = 'google_ads')
    OR (LOWER(l.utm_source) IN ('email', 'outreach') AND ls.source_key = 'email_outreach')
  );

--------------------------------------------------------------------------------
-- Step 5: Create or update the lead_source_summary view for better reporting
--------------------------------------------------------------------------------

-- Drop the existing view first (required when changing column structure)
DROP VIEW IF EXISTS lead_source_summary;

-- Create the new view with updated columns
CREATE VIEW lead_source_summary AS
SELECT
  COALESCE(
    ls.name,
    slm.source_name,
    CASE
      WHEN LOWER(l.utm_source) IN ('fb', 'facebook') THEN 'Facebook Ads'
      WHEN LOWER(l.utm_source) IN ('ig', 'instagram') THEN 'Instagram Ads'
      WHEN LOWER(l.utm_source) = 'linkedin' THEN 'LinkedIn Ads'
      WHEN LOWER(l.utm_source) = 'google' THEN 'Google'
      WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'Email Outreach'
      WHEN l.booking_link_id IS NOT NULL THEN 'SavvyCal Direct'
      ELSE 'Unknown'
    END
  ) AS source_name,
  COALESCE(
    l.source_channel,
    ls.channel,
    slm.channel,
    CASE
      WHEN LOWER(l.utm_source) IN ('fb', 'facebook', 'ig', 'instagram', 'linkedin') THEN 'paid_social'
      WHEN LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'paid_search'
      WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'email'
      WHEN l.booking_link_id IS NOT NULL THEN 'direct'
      ELSE NULL
    END
  ) AS channel,
  l.owner_id,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'ready') AS ready_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'prepping') AS prepping_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'cancelled') AS cancelled_leads,
  MIN(l.created_at) AS first_lead_at,
  MAX(l.created_at) AS last_lead_at,
  -- Calculate conversion rate
  ROUND(
    COALESCE(
      COUNT(l.id) FILTER (WHERE l.status = 'converted')::DECIMAL * 100.0 /
      NULLIF(COUNT(l.id) FILTER (WHERE l.status != 'cancelled'), 0),
      0
    ),
    1
  ) AS conversion_rate
FROM leads l
LEFT JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN savvycal_link_mappings slm ON slm.link_id = l.booking_link_id
WHERE l.deleted_at IS NULL
GROUP BY
  COALESCE(
    ls.name,
    slm.source_name,
    CASE
      WHEN LOWER(l.utm_source) IN ('fb', 'facebook') THEN 'Facebook Ads'
      WHEN LOWER(l.utm_source) IN ('ig', 'instagram') THEN 'Instagram Ads'
      WHEN LOWER(l.utm_source) = 'linkedin' THEN 'LinkedIn Ads'
      WHEN LOWER(l.utm_source) = 'google' THEN 'Google'
      WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'Email Outreach'
      WHEN l.booking_link_id IS NOT NULL THEN 'SavvyCal Direct'
      ELSE 'Unknown'
    END
  ),
  COALESCE(
    l.source_channel,
    ls.channel,
    slm.channel,
    CASE
      WHEN LOWER(l.utm_source) IN ('fb', 'facebook', 'ig', 'instagram', 'linkedin') THEN 'paid_social'
      WHEN LOWER(l.utm_source) = 'google' AND LOWER(l.utm_medium) IN ('cpc', 'ppc', 'paid') THEN 'paid_search'
      WHEN LOWER(l.utm_source) IN ('email', 'outreach') THEN 'email'
      WHEN l.booking_link_id IS NOT NULL THEN 'direct'
      ELSE NULL
    END
  ),
  l.owner_id
ORDER BY total_leads DESC;

COMMENT ON VIEW lead_source_summary IS 'Aggregated metrics summarising lead volume and conversion by source/channel/owner';
