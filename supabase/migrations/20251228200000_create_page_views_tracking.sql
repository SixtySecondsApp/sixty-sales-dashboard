-- Create page_views table for landing page analytics
-- Tracks page views with UTM parameters and session data

CREATE TABLE IF NOT EXISTS public.page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Session tracking
  session_id text NOT NULL,
  visitor_id text,  -- Anonymous persistent ID (stored in localStorage)

  -- Page info
  landing_page text NOT NULL,  -- e.g., '/intro', '/waitlist', '/introducing'
  full_url text,
  referrer text,

  -- UTM parameters (matching meta_ads_analytics structure)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,  -- Creative/Ad ID
  utm_term text,     -- Ad Set ID
  utm_id text,       -- Campaign ID (Meta-specific)

  -- Meta-specific tracking
  fbclid text,       -- Facebook click ID

  -- Device & browser info (optional, privacy-conscious)
  device_type text,  -- 'mobile', 'tablet', 'desktop'
  browser text,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Index for efficient querying
  CONSTRAINT page_views_session_id_check CHECK (session_id <> '')
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_landing_page ON public.page_views(landing_page);
CREATE INDEX IF NOT EXISTS idx_page_views_utm_source ON public.page_views(utm_source);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON public.page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON public.page_views(visitor_id);

-- Composite index for UTM analysis
CREATE INDEX IF NOT EXISTS idx_page_views_utm_composite
ON public.page_views(utm_source, utm_campaign, utm_content, landing_page);

-- Enable RLS (public table - no auth required for inserts)
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert page views (anonymous tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Only authenticated admins can read page views
CREATE POLICY "Admins can read page views"
ON public.page_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Create landing page analytics view combining page views and conversions
CREATE OR REPLACE VIEW public.landing_page_analytics AS
WITH daily_views AS (
  SELECT
    DATE(created_at) as date,
    landing_page,
    COALESCE(utm_source,
      CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END
    ) as source,
    utm_campaign,
    utm_content as creative_id,
    COUNT(*) as page_views,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT visitor_id) as unique_visitors
  FROM public.page_views
  GROUP BY
    DATE(created_at),
    landing_page,
    COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END),
    utm_campaign,
    utm_content
),
daily_conversions AS (
  SELECT
    DATE(created_at) as date,
    CASE
      WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
      WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
      WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
      WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
      ELSE 'other'
    END as landing_page,
    COALESCE(utm_source,
      CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'direct' END
    ) as source,
    utm_campaign,
    (regexp_match(registration_url, 'utm_content=([^&]+)'))[1] as creative_id,
    COUNT(*) as conversions
  FROM public.meetings_waitlist
  WHERE is_seeded IS NOT TRUE
  GROUP BY
    DATE(created_at),
    CASE
      WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
      WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
      WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
      WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
      ELSE 'other'
    END,
    COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'direct' END),
    utm_campaign,
    (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]
)
SELECT
  COALESCE(v.date, c.date) as date,
  COALESCE(v.landing_page, c.landing_page) as landing_page,
  COALESCE(v.source, c.source) as source,
  COALESCE(v.utm_campaign, c.utm_campaign) as campaign,
  COALESCE(v.creative_id, c.creative_id) as creative_id,
  COALESCE(v.page_views, 0) as page_views,
  COALESCE(v.unique_sessions, 0) as unique_sessions,
  COALESCE(v.unique_visitors, 0) as unique_visitors,
  COALESCE(c.conversions, 0) as conversions,
  CASE
    WHEN COALESCE(v.unique_sessions, 0) > 0
    THEN ROUND((COALESCE(c.conversions, 0)::numeric / v.unique_sessions::numeric) * 100, 2)
    ELSE 0
  END as conversion_rate
FROM daily_views v
FULL OUTER JOIN daily_conversions c
  ON v.date = c.date
  AND v.landing_page = c.landing_page
  AND v.source = c.source
  AND COALESCE(v.utm_campaign, '') = COALESCE(c.utm_campaign, '')
  AND COALESCE(v.creative_id, '') = COALESCE(c.creative_id, '')
ORDER BY date DESC, page_views DESC;

-- Add helpful comments
COMMENT ON TABLE public.page_views IS
  'Landing page view tracking with UTM parameters for Meta/Facebook ads attribution';

COMMENT ON VIEW public.landing_page_analytics IS
  'Combined page views and conversion analytics with conversion rate calculation';
