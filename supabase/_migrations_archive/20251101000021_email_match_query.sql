-- Email Match Analysis - Returns actual query results

-- Query 1: Match statistics
SELECT
  'Match Statistics' as analysis,
  (SELECT COUNT(*) FROM deals
   WHERE contact_email IS NOT NULL
     AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') as deals_with_valid_email,
  (SELECT COUNT(DISTINCT d.id)
   FROM deals d
   INNER JOIN contacts c ON LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
   WHERE d.contact_email IS NOT NULL) as deals_with_matching_contact,
  ROUND(100.0 *
    (SELECT COUNT(DISTINCT d.id)
     FROM deals d
     INNER JOIN contacts c ON LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
     WHERE d.contact_email IS NOT NULL)
    /
    NULLIF((SELECT COUNT(*) FROM deals
            WHERE contact_email IS NOT NULL
              AND contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), 0)
  , 1) as match_rate_pct;

-- Query 2: Sample matches
SELECT
  'Sample Matches' as analysis,
  d.id as deal_id,
  d.contact_email as deal_email,
  c.id as contact_id,
  c.email as contact_db_email,
  c.company_id,
  co.name as company_name
FROM deals d
INNER JOIN contacts c ON LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
INNER JOIN companies co ON c.company_id = co.id
WHERE d.company_id IS NULL
  AND d.contact_email IS NOT NULL
LIMIT 10;

-- Query 3: Sample of unmatched deals
SELECT
  'Unmatched Deals Sample' as analysis,
  d.id as deal_id,
  d.contact_email as deal_email,
  d.company as deal_company,
  d.contact_name
FROM deals d
WHERE d.company_id IS NULL
  AND d.contact_email IS NOT NULL
  AND d.contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  AND NOT EXISTS (
    SELECT 1 FROM contacts c
    WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(d.contact_email))
  )
LIMIT 10;

-- Query 4: Sample of contacts
SELECT
  'Contact Sample' as analysis,
  id as contact_id,
  email,
  first_name,
  last_name,
  company_id
FROM contacts
LIMIT 10;
