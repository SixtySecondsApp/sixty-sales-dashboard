-- Check Viewpoint deals to understand the multiple deals issue

-- Step 1: Check activities for Viewpoint
SELECT 
    'Viewpoint Activities' as info,
    id,
    client_name,
    date,
    deal_id,
    sales_rep,
    amount,
    activity_type
FROM activities 
WHERE client_name ILIKE '%viewpoint%' 
  AND type = 'sale' 
  AND status = 'completed'
ORDER BY date;

-- Step 2: Check deals for Viewpoint
SELECT 
    'Viewpoint Deals' as info,
    id,
    name,
    company,
    value,
    monthly_mrr,
    one_off_revenue,
    status,
    created_at
FROM deals 
WHERE company ILIKE '%viewpoint%'
ORDER BY created_at;

-- Step 3: Check clients for Viewpoint
SELECT 
    'Viewpoint Clients' as info,
    id,
    company_name,
    deal_id,
    subscription_amount,
    status,
    subscription_start_date
FROM clients 
WHERE company_name ILIKE '%viewpoint%'
ORDER BY subscription_start_date;

-- Step 4: Check if there are multiple deals that should create multiple client records
SELECT 
    'Expected Client Records' as info,
    d.id as deal_id,
    d.name as deal_name,
    d.company,
    d.monthly_mrr,
    d.one_off_revenue,
    d.status,
    EXISTS(SELECT 1 FROM clients c WHERE c.deal_id = d.id) as has_client_record
FROM deals d
WHERE d.company ILIKE '%viewpoint%'
  AND d.status = 'won'
ORDER BY d.created_at;