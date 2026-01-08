-- Add deal stage tracking to lead source summary view
-- Tracks leads through the sales pipeline: SQL → Opportunity → Verbal → Signed → Lost

--------------------------------------------------------------------------------
-- Drop and recreate the lead_source_summary view with deal stage tracking
--------------------------------------------------------------------------------

DROP VIEW IF EXISTS lead_source_summary;

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

  -- Lead status counts
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'new') AS new_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'prepping') AS prepping_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'ready') AS ready_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'cancelled') AS cancelled_leads,

  -- Deal stage counts (for converted leads)
  COUNT(d.id) FILTER (WHERE ds.name = 'SQL') AS sql_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Opportunity') AS opportunity_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Verbal') AS verbal_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Signed') AS signed_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Lost') AS lost_stage,

  -- Revenue metrics (from converted deals)
  COALESCE(SUM(d.one_off_revenue), 0) AS total_one_off_revenue,
  COALESCE(SUM(d.monthly_mrr), 0) AS total_monthly_revenue,
  COALESCE(SUM((d.monthly_mrr * 3) + d.one_off_revenue), 0) AS total_ltv,

  -- Date ranges
  MIN(l.created_at) AS first_lead_at,
  MAX(l.created_at) AS last_lead_at,

  -- Conversion rates
  ROUND(
    COALESCE(
      COUNT(l.id) FILTER (WHERE l.status = 'converted')::DECIMAL * 100.0 /
      NULLIF(COUNT(l.id) FILTER (WHERE l.status != 'cancelled'), 0),
      0
    ),
    1
  ) AS conversion_rate,

  -- Win rate (Signed / Total Converted)
  ROUND(
    COALESCE(
      COUNT(d.id) FILTER (WHERE ds.name = 'Signed')::DECIMAL * 100.0 /
      NULLIF(COUNT(d.id), 0),
      0
    ),
    1
  ) AS win_rate

FROM leads l
LEFT JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN savvycal_link_mappings slm ON slm.link_id = l.booking_link_id
LEFT JOIN deals d ON d.id = l.converted_deal_id
LEFT JOIN deal_stages ds ON ds.id = d.stage_id
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

COMMENT ON VIEW lead_source_summary IS 'Lead source performance with deal stage tracking and revenue metrics';
