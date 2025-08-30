
-- Check how many deals Viewpoint has
SELECT 
    d.name as deal_name,
    d.id as deal_id,
    d.company_name,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    d.annual_value
FROM deals d 
WHERE LOWER(d.company_name) LIKE '%viewpoint%'
ORDER BY d.created_at;

-- Check clients table for Viewpoint
SELECT 
    c.company_name,
    c.deal_id,
    c.subscription_amount,
    c.status,
    c.created_at
FROM clients c 
WHERE LOWER(c.company_name) LIKE '%viewpoint%'
ORDER BY c.created_at;

