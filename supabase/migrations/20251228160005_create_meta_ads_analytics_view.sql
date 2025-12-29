-- Create Meta Ads Analytics view
-- Aggregates waitlist signups by UTM parameters to track ad performance

CREATE OR REPLACE VIEW public.meta_ads_analytics AS
WITH parsed_signups AS (
  SELECT
    id,
    email,
    full_name,
    company_name,
    created_at,
    registration_url,
    utm_source,
    utm_medium,
    utm_campaign,
    -- Extract utm_content (creative/ad ID) from registration_url if not in column
    COALESCE(
      -- First try the utm_content column if it exists
      NULL, -- placeholder, we'll use the URL parsing
      -- Parse from registration_url
      (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]
    ) as utm_content,
    -- Extract utm_term (ad set ID) from registration_url
    (regexp_match(registration_url, 'utm_term=([^&]+)'))[1] as utm_term,
    -- Extract utm_id (campaign ID) from registration_url
    (regexp_match(registration_url, 'utm_id=([^&]+)'))[1] as utm_id,
    -- Extract fbclid for Facebook click tracking
    (regexp_match(registration_url, 'fbclid=([^&]+)'))[1] as fbclid,
    -- Derive landing page (path without query params)
    CASE
      WHEN registration_url LIKE '%?%' THEN split_part(registration_url, '?', 1)
      ELSE registration_url
    END as landing_page
  FROM public.meetings_waitlist
  WHERE is_seeded IS NOT TRUE
    AND (
      utm_source IS NOT NULL
      OR registration_url LIKE '%utm_%'
      OR registration_url LIKE '%fbclid%'
    )
)
SELECT
  -- Source/Platform
  COALESCE(utm_source,
    CASE
      WHEN fbclid IS NOT NULL THEN 'facebook'
      ELSE 'unknown'
    END
  ) as source,
  -- Readable source name
  CASE COALESCE(utm_source,
    CASE WHEN fbclid IS NOT NULL THEN 'fb' ELSE 'unknown' END
  )
    WHEN 'fb' THEN 'Facebook'
    WHEN 'ig' THEN 'Instagram'
    WHEN 'an' THEN 'Audience Network'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'messenger' THEN 'Messenger'
    ELSE COALESCE(utm_source, 'Unknown')
  END as source_name,
  -- Medium (paid, organic, etc)
  COALESCE(utm_medium, 'unknown') as medium,
  -- Campaign ID
  utm_campaign as campaign_id,
  utm_id as meta_campaign_id,
  -- Creative/Ad ID
  utm_content as creative_id,
  -- Ad Set ID
  utm_term as adset_id,
  -- Landing page
  landing_page,
  -- Aggregations
  COUNT(*) as conversions,
  MIN(created_at) as first_conversion,
  MAX(created_at) as last_conversion,
  -- List of signups (for drill-down)
  array_agg(jsonb_build_object(
    'id', id,
    'email', email,
    'name', full_name,
    'company', company_name,
    'date', created_at
  ) ORDER BY created_at DESC) as signups
FROM parsed_signups
GROUP BY
  COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'unknown' END),
  CASE COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'fb' ELSE 'unknown' END)
    WHEN 'fb' THEN 'Facebook'
    WHEN 'ig' THEN 'Instagram'
    WHEN 'an' THEN 'Audience Network'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'messenger' THEN 'Messenger'
    ELSE COALESCE(utm_source, 'Unknown')
  END,
  COALESCE(utm_medium, 'unknown'),
  utm_campaign,
  utm_id,
  utm_content,
  utm_term,
  landing_page
ORDER BY conversions DESC;

-- Also create a simpler daily summary view
CREATE OR REPLACE VIEW public.meta_ads_daily_summary AS
SELECT
  DATE(created_at) as date,
  COALESCE(utm_source,
    CASE
      WHEN registration_url LIKE '%fbclid%' THEN 'facebook'
      ELSE 'organic'
    END
  ) as source,
  CASE
    WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
    WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
    WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
    WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
    ELSE 'other'
  END as landing_page,
  COUNT(*) as conversions,
  COUNT(DISTINCT (regexp_match(registration_url, 'utm_campaign=([^&]+)'))[1]) as campaigns,
  COUNT(DISTINCT (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]) as creatives
FROM public.meetings_waitlist
WHERE is_seeded IS NOT TRUE
GROUP BY
  DATE(created_at),
  COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'organic' END),
  CASE
    WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
    WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
    WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
    WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
    ELSE 'other'
  END
ORDER BY date DESC, conversions DESC;

COMMENT ON VIEW public.meta_ads_analytics IS
  'Meta (Facebook/Instagram) ads performance analytics with UTM parameter tracking';

COMMENT ON VIEW public.meta_ads_daily_summary IS
  'Daily summary of Meta ads conversions by source and landing page';
