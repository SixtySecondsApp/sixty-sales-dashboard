-- Verify Viewpoint payment records are created
SELECT 
    'DEALS' as table_name,
    d.id,
    d.name as deal_name,
    d.company,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    d.created_at
FROM deals d 
WHERE LOWER(d.company) LIKE '%viewpoint%'
ORDER BY d.created_at

UNION ALL

SELECT 
    'PAYMENTS' as table_name,
    c.deal_id as id,
    d.name as deal_name,
    c.company_name as company,
    c.status::text,
    d.one_off_revenue,
    c.subscription_amount as monthly_mrr,
    c.created_at
FROM clients c
INNER JOIN deals d ON d.id = c.deal_id
WHERE LOWER(c.company_name) LIKE '%viewpoint%'
ORDER BY c.created_at;