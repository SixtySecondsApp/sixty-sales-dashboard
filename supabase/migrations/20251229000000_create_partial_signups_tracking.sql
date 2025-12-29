-- Create partial_signups table for lead capture
-- Tracks when users enter their email but don't complete the full form

CREATE TABLE IF NOT EXISTS public.partial_signups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lead info
  email text NOT NULL,

  -- Session tracking (links to page_views)
  session_id text NOT NULL,
  visitor_id text,

  -- Page context
  landing_page text NOT NULL,
  form_step text DEFAULT 'email',  -- 'email', 'name', 'company', 'tools'

  -- UTM parameters (for attribution)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,

  -- Status
  converted boolean DEFAULT false,  -- Set to true when full signup completes
  converted_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT partial_signups_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_partial_signups_email ON public.partial_signups(email);
CREATE INDEX IF NOT EXISTS idx_partial_signups_session ON public.partial_signups(session_id);
CREATE INDEX IF NOT EXISTS idx_partial_signups_landing_page ON public.partial_signups(landing_page);
CREATE INDEX IF NOT EXISTS idx_partial_signups_created_at ON public.partial_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partial_signups_converted ON public.partial_signups(converted) WHERE converted = false;

-- Unique constraint: one partial signup per email per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_partial_signups_email_session
ON public.partial_signups(email, session_id);

-- Enable RLS
ALTER TABLE public.partial_signups ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (anonymous tracking)
CREATE POLICY "Anyone can insert partial signups"
ON public.partial_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Anyone can update their own partial signup (to mark converted)
CREATE POLICY "Anyone can update partial signups by session"
ON public.partial_signups
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy: Only admins can read
CREATE POLICY "Admins can read partial signups"
ON public.partial_signups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_partial_signups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partial_signups_updated_at
  BEFORE UPDATE ON public.partial_signups
  FOR EACH ROW
  EXECUTE FUNCTION update_partial_signups_updated_at();

-- Update landing_page_analytics view to include partial signups
DROP VIEW IF EXISTS public.landing_page_analytics;

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
daily_partial_signups AS (
  SELECT
    DATE(created_at) as date,
    landing_page,
    COALESCE(utm_source,
      CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END
    ) as source,
    utm_campaign,
    utm_content as creative_id,
    COUNT(*) as partial_signups,
    COUNT(*) FILTER (WHERE converted = true) as partial_converted
  FROM public.partial_signups
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
      WHEN registration_url LIKE '%/join%' THEN '/join'
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
      WHEN registration_url LIKE '%/join%' THEN '/join'
      ELSE 'other'
    END,
    COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'direct' END),
    utm_campaign,
    (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]
)
SELECT
  COALESCE(v.date, c.date, p.date) as date,
  COALESCE(v.landing_page, c.landing_page, p.landing_page) as landing_page,
  COALESCE(v.source, c.source, p.source) as source,
  COALESCE(v.utm_campaign, c.utm_campaign, p.utm_campaign) as campaign,
  COALESCE(v.creative_id, c.creative_id, p.creative_id) as creative_id,
  COALESCE(v.page_views, 0) as page_views,
  COALESCE(v.unique_sessions, 0) as unique_sessions,
  COALESCE(v.unique_visitors, 0) as unique_visitors,
  COALESCE(p.partial_signups, 0) as partial_signups,
  COALESCE(c.conversions, 0) as conversions,
  -- Conversion rate (full conversions / unique sessions)
  CASE
    WHEN COALESCE(v.unique_sessions, 0) > 0
    THEN ROUND((COALESCE(c.conversions, 0)::numeric / v.unique_sessions::numeric) * 100, 2)
    ELSE 0
  END as conversion_rate,
  -- Lead capture rate (partial signups / unique sessions)
  CASE
    WHEN COALESCE(v.unique_sessions, 0) > 0
    THEN ROUND((COALESCE(p.partial_signups, 0)::numeric / v.unique_sessions::numeric) * 100, 2)
    ELSE 0
  END as lead_capture_rate
FROM daily_views v
FULL OUTER JOIN daily_conversions c
  ON v.date = c.date
  AND v.landing_page = c.landing_page
  AND v.source = c.source
  AND COALESCE(v.utm_campaign, '') = COALESCE(c.utm_campaign, '')
  AND COALESCE(v.creative_id, '') = COALESCE(c.creative_id, '')
FULL OUTER JOIN daily_partial_signups p
  ON COALESCE(v.date, c.date) = p.date
  AND COALESCE(v.landing_page, c.landing_page) = p.landing_page
  AND COALESCE(v.source, c.source) = p.source
  AND COALESCE(v.utm_campaign, c.utm_campaign, '') = COALESCE(p.utm_campaign, '')
  AND COALESCE(v.creative_id, c.creative_id, '') = COALESCE(p.creative_id, '')
ORDER BY date DESC, page_views DESC;

-- Comments
COMMENT ON TABLE public.partial_signups IS
  'Tracks partial form submissions (email entered but form not completed) as leads';

COMMENT ON VIEW public.landing_page_analytics IS
  'Combined page views, partial signups, and full conversions with rates';
