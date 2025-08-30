
-- Check all Viewpoint deals
SELECT 
    d.id,
    d.name,
    d.company_name,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    d.annual_value,
    d.created_at
FROM deals d 
WHERE LOWER(d.company_name) LIKE '%viewpoint%'
ORDER BY d.created_at;

-- Check all won deals that DON'T have client records
SELECT 
    d.id,
    d.name,
    d.company_name,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    d.annual_value,
    CASE WHEN c.id IS NOT NULL THEN 'HAS CLIENT' ELSE 'NO CLIENT' END as client_status
FROM deals d 
LEFT JOIN clients c ON c.deal_id = d.id
WHERE d.status = 'won'
ORDER BY d.company_name, d.created_at;

