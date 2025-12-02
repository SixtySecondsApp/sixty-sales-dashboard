-- Debug queries for lead source tracking issues
-- Run these in Supabase SQL Editor to diagnose the problems

-- ============================================================================
-- Query 1: Check if view has data at all
-- ============================================================================
SELECT
  source_name,
  total_leads,
  sql_stage,
  opportunity_stage,
  verbal_stage,
  signed_stage,
  lost_stage
FROM lead_source_summary
ORDER BY total_leads DESC
LIMIT 10;

-- Expected: Should show LinkedIn Ads with 573 total_leads
-- If stage columns are 0 or NULL, deals aren't linked properly


-- ============================================================================
-- Query 2: Check lead -> deal linkage
-- ============================================================================
SELECT
  COUNT(*) as total_leads,
  COUNT(converted_deal_id) as leads_with_deals,
  COUNT(DISTINCT converted_deal_id) as unique_deals
FROM leads
WHERE deleted_at IS NULL;

-- Expected: Should show how many leads have converted_deal_id


-- ============================================================================
-- Query 3: Check deals with stages
-- ============================================================================
SELECT
  ds.name as stage_name,
  COUNT(d.id) as deal_count
FROM deals d
LEFT JOIN deal_stages ds ON ds.id = d.stage_id
GROUP BY ds.name
ORDER BY deal_count DESC;

-- Expected: Should show distribution of deals across stages


-- ============================================================================
-- Query 4: Check if LinkedIn Ads leads have deals
-- ============================================================================
SELECT
  l.id,
  l.contact_name,
  l.contact_email,
  l.status as lead_status,
  l.converted_deal_id,
  d.name as deal_name,
  ds.name as deal_stage
FROM leads l
LEFT JOIN savvycal_link_mappings slm ON slm.link_id = l.booking_link_id
LEFT JOIN deals d ON d.id = l.converted_deal_id
LEFT JOIN deal_stages ds ON ds.id = d.stage_id
WHERE slm.source_name = 'LinkedIn Ads'
  AND l.deleted_at IS NULL
LIMIT 10;

-- Expected: Should show LinkedIn Ads leads and their deal info


-- ============================================================================
-- Query 5: Check lead source resolution for LinkedIn Ads
-- ============================================================================
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN booking_link_id IS NOT NULL THEN 1 END) as with_link,
  COUNT(CASE WHEN booking_link_id = 'link_01JBH7K597B546RDY6VW39RFCK' THEN 1 END) as linkedin_link,
  COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_status,
  COUNT(CASE WHEN converted_deal_id IS NOT NULL THEN 1 END) as with_deal_id
FROM leads
WHERE deleted_at IS NULL
  AND (
    booking_link_id = 'link_01JBH7K597B546RDY6VW39RFCK'
    OR utm_source ILIKE '%linkedin%'
  );

-- Expected: Should show 573 total, and how many are converted


-- ============================================================================
-- Query 6: Test the exact view query for LinkedIn Ads
-- ============================================================================
SELECT
  COALESCE(
    ls.name,
    slm.source_name,
    CASE
      WHEN LOWER(l.utm_source) = 'linkedin' THEN 'LinkedIn Ads'
      ELSE 'Unknown'
    END
  ) AS source_name,
  COUNT(l.id) AS total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
  COUNT(d.id) AS total_deals,
  COUNT(d.id) FILTER (WHERE ds.name = 'SQL') AS sql_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Opportunity') AS opportunity_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Verbal') AS verbal_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Signed') AS signed_stage,
  COUNT(d.id) FILTER (WHERE ds.name = 'Lost') AS lost_stage
FROM leads l
LEFT JOIN lead_sources ls ON ls.id = l.source_id
LEFT JOIN savvycal_link_mappings slm ON slm.link_id = l.booking_link_id
LEFT JOIN deals d ON d.id = l.converted_deal_id
LEFT JOIN deal_stages ds ON ds.id = d.stage_id
WHERE l.deleted_at IS NULL
  AND (
    slm.source_name = 'LinkedIn Ads'
    OR LOWER(l.utm_source) = 'linkedin'
    OR l.booking_link_id = 'link_01JBH7K597B546RDY6VW39RFCK'
  )
GROUP BY
  COALESCE(
    ls.name,
    slm.source_name,
    CASE
      WHEN LOWER(l.utm_source) = 'linkedin' THEN 'LinkedIn Ads'
      ELSE 'Unknown'
    END
  );

-- Expected: Should match what you see in the UI
