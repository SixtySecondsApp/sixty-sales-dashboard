
-- Look for any company names that might be Viewpoint variations
-- Check for partial matches and similar names
SELECT DISTINCT
    d.company,
    d.name as deal_name,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    d.created_at
FROM deals d 
WHERE LOWER(d.company) LIKE '%view%' 
   OR LOWER(d.company) LIKE '%point%'
   OR LOWER(d.name) LIKE '%viewpoint%'
ORDER BY d.company, d.created_at;

-- Also check if there are any activities mentioning Viewpoint
SELECT DISTINCT
    a.company_name,
    a.description,
    a.deal_id,
    d.name as deal_name
FROM activities a
LEFT JOIN deals d ON d.id = a.deal_id
WHERE LOWER(a.company_name) LIKE '%view%' 
   OR LOWER(a.company_name) LIKE '%point%'
   OR LOWER(a.description) LIKE '%viewpoint%'
ORDER BY a.company_name;

