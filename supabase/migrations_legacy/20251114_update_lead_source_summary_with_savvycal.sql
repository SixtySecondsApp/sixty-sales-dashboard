-- Update lead_source_summary view to include SavvyCal source conversion tracking
-- This adds conversion data from deals created from SavvyCal bookings

-- Drop existing view if it exists
DROP VIEW IF EXISTS lead_source_summary;

-- Create view (handle org_id conditionally)
DO $$
DECLARE
  has_org_id BOOLEAN;
  view_sql TEXT;
BEGIN
  -- Check if deals table has org_id column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'deals' 
    AND column_name = 'org_id'
  ) INTO has_org_id;

  -- Build view SQL based on whether org_id exists
  IF has_org_id THEN
    view_sql := '
CREATE VIEW lead_source_summary AS
WITH savvycal_deal_sources AS (
  SELECT
    COALESCE(bs.name, ssm.source) AS source_name,
    COALESCE(bs.name, ssm.source) AS source_key,
    bs.category AS channel,
    NULL::TEXT AS medium,
    NULL::TEXT AS campaign,
    d.owner_id,
    COUNT(DISTINCT d.id) AS total_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE ds.name = ''Signed'') AS converted_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE ds.name IN (''Opportunity'', ''Verbal'')) AS active_deals
  FROM deals d
  JOIN savvycal_source_mappings ssm ON ssm.link_id = d.savvycal_link_id
  LEFT JOIN booking_sources bs ON bs.id = ssm.source_id
  LEFT JOIN deal_stages ds ON ds.id = d.stage_id
  WHERE d.savvycal_link_id IS NOT NULL
    AND d.status = ''active''
    AND (d.org_id = ssm.org_id OR ssm.org_id IS NULL)
  GROUP BY
    COALESCE(bs.name, ssm.source),
    bs.category,
    d.owner_id,
    ssm.org_id
),
lead_sources_data AS (
  SELECT
    l.source_id,
    ls.source_key,
    ls.name AS source_name,
    COALESCE(l.source_channel, ls.channel) AS channel,
    COALESCE(l.source_medium, ls.utm_medium) AS medium,
    COALESCE(l.source_campaign, ls.utm_campaign) AS campaign,
    l.owner_id,
    COUNT(l.id) AS total_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''converted'') AS converted_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''ready'') AS ready_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''prepping'') AS prepping_leads,
    MIN(l.created_at) AS first_lead_at,
    MAX(l.created_at) AS last_lead_at
  FROM leads l
  LEFT JOIN lead_sources ls ON ls.id = l.source_id
  WHERE l.deleted_at IS NULL
  GROUP BY
    l.source_id,
    ls.source_key,
    ls.name,
    COALESCE(l.source_channel, ls.channel),
    COALESCE(l.source_medium, ls.utm_medium),
    COALESCE(l.source_campaign, ls.utm_campaign),
    l.owner_id
)
SELECT
  COALESCE(lsd.source_id::TEXT, sds.source_name) AS source_id,
  COALESCE(lsd.source_key, sds.source_key) AS source_key,
  COALESCE(lsd.source_name, sds.source_name) AS source_name,
  COALESCE(lsd.channel, sds.channel) AS channel,
  COALESCE(lsd.medium, sds.medium) AS medium,
  COALESCE(lsd.campaign, sds.campaign) AS campaign,
  COALESCE(lsd.owner_id, sds.owner_id) AS owner_id,
  COALESCE(lsd.total_leads, 0)::BIGINT + COALESCE(sds.total_deals, 0)::BIGINT AS total_leads,
  COALESCE(lsd.converted_leads, 0)::BIGINT + COALESCE(sds.converted_deals, 0)::BIGINT AS converted_leads,
  COALESCE(lsd.ready_leads, 0)::BIGINT + COALESCE(sds.active_deals, 0)::BIGINT AS ready_leads,
  COALESCE(lsd.prepping_leads, 0)::BIGINT AS prepping_leads,
  LEAST(
    COALESCE(lsd.first_lead_at, ''9999-12-31''::TIMESTAMPTZ),
    (SELECT MIN(created_at) FROM deals WHERE savvycal_link_id IS NOT NULL)
  ) AS first_lead_at,
  GREATEST(
    COALESCE(lsd.last_lead_at, ''1970-01-01''::TIMESTAMPTZ),
    (SELECT MAX(created_at) FROM deals WHERE savvycal_link_id IS NOT NULL)
  ) AS last_lead_at
FROM lead_sources_data lsd
FULL OUTER JOIN savvycal_deal_sources sds
  ON lsd.source_key = sds.source_key
  AND lsd.owner_id = sds.owner_id;';
  ELSE
    view_sql := '
CREATE VIEW lead_source_summary AS
WITH savvycal_deal_sources AS (
  SELECT
    COALESCE(bs.name, ssm.source) AS source_name,
    COALESCE(bs.name, ssm.source) AS source_key,
    bs.category AS channel,
    NULL::TEXT AS medium,
    NULL::TEXT AS campaign,
    d.owner_id,
    COUNT(DISTINCT d.id) AS total_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE ds.name = ''Signed'') AS converted_deals,
    COUNT(DISTINCT d.id) FILTER (WHERE ds.name IN (''Opportunity'', ''Verbal'')) AS active_deals
  FROM deals d
  JOIN savvycal_source_mappings ssm ON ssm.link_id = d.savvycal_link_id
  LEFT JOIN booking_sources bs ON bs.id = ssm.source_id
  LEFT JOIN deal_stages ds ON ds.id = d.stage_id
  WHERE d.savvycal_link_id IS NOT NULL
    AND d.status = ''active''
  GROUP BY
    COALESCE(bs.name, ssm.source),
    bs.category,
    d.owner_id,
    ssm.org_id
),
lead_sources_data AS (
  SELECT
    l.source_id,
    ls.source_key,
    ls.name AS source_name,
    COALESCE(l.source_channel, ls.channel) AS channel,
    COALESCE(l.source_medium, ls.utm_medium) AS medium,
    COALESCE(l.source_campaign, ls.utm_campaign) AS campaign,
    l.owner_id,
    COUNT(l.id) AS total_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''converted'') AS converted_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''ready'') AS ready_leads,
    COUNT(l.id) FILTER (WHERE l.status = ''prepping'') AS prepping_leads,
    MIN(l.created_at) AS first_lead_at,
    MAX(l.created_at) AS last_lead_at
  FROM leads l
  LEFT JOIN lead_sources ls ON ls.id = l.source_id
  WHERE l.deleted_at IS NULL
  GROUP BY
    l.source_id,
    ls.source_key,
    ls.name,
    COALESCE(l.source_channel, ls.channel),
    COALESCE(l.source_medium, ls.utm_medium),
    COALESCE(l.source_campaign, ls.utm_campaign),
    l.owner_id
)
SELECT
  COALESCE(lsd.source_id::TEXT, sds.source_name) AS source_id,
  COALESCE(lsd.source_key, sds.source_key) AS source_key,
  COALESCE(lsd.source_name, sds.source_name) AS source_name,
  COALESCE(lsd.channel, sds.channel) AS channel,
  COALESCE(lsd.medium, sds.medium) AS medium,
  COALESCE(lsd.campaign, sds.campaign) AS campaign,
  COALESCE(lsd.owner_id, sds.owner_id) AS owner_id,
  COALESCE(lsd.total_leads, 0)::BIGINT + COALESCE(sds.total_deals, 0)::BIGINT AS total_leads,
  COALESCE(lsd.converted_leads, 0)::BIGINT + COALESCE(sds.converted_deals, 0)::BIGINT AS converted_leads,
  COALESCE(lsd.ready_leads, 0)::BIGINT + COALESCE(sds.active_deals, 0)::BIGINT AS ready_leads,
  COALESCE(lsd.prepping_leads, 0)::BIGINT AS prepping_leads,
  LEAST(
    COALESCE(lsd.first_lead_at, ''9999-12-31''::TIMESTAMPTZ),
    (SELECT MIN(created_at) FROM deals WHERE savvycal_link_id IS NOT NULL)
  ) AS first_lead_at,
  GREATEST(
    COALESCE(lsd.last_lead_at, ''1970-01-01''::TIMESTAMPTZ),
    (SELECT MAX(created_at) FROM deals WHERE savvycal_link_id IS NOT NULL)
  ) AS last_lead_at
FROM lead_sources_data lsd
FULL OUTER JOIN savvycal_deal_sources sds
  ON lsd.source_key = sds.source_key
  AND lsd.owner_id = sds.owner_id;';
  END IF;

  -- Execute the view creation
  EXECUTE view_sql;
END $$;

COMMENT ON VIEW lead_source_summary IS 'Aggregated metrics summarising lead volume and outcomes by source/channel/owner, including SavvyCal booking conversions';
