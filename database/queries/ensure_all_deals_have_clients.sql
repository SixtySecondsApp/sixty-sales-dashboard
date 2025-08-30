-- Ensure ALL won deals have corresponding client records
-- This will create client records for any won deals that are missing them

-- Step 1: Check current situation
DO $$
DECLARE
    total_won_deals INTEGER;
    deals_with_clients INTEGER;
    missing_clients INTEGER;
BEGIN
    -- Count total won deals
    SELECT COUNT(*) INTO total_won_deals FROM deals WHERE status = 'won';
    
    -- Count won deals with client records
    SELECT COUNT(*) INTO deals_with_clients 
    FROM deals d 
    INNER JOIN clients c ON c.deal_id = d.id 
    WHERE d.status = 'won';
    
    missing_clients := total_won_deals - deals_with_clients;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 CURRENT SITUATION:';
    RAISE NOTICE 'Total won deals: %', total_won_deals;
    RAISE NOTICE 'Deals with clients: %', deals_with_clients;
    RAISE NOTICE 'Missing client records: %', missing_clients;
    RAISE NOTICE '';
END $$;

-- Step 2: Create client records for ALL won deals that don't have them
INSERT INTO clients (
    company_name,
    deal_id,
    subscription_amount,
    status,
    subscription_start_date,
    created_at,
    updated_at
)
SELECT 
    d.company,
    d.id as deal_id,
    COALESCE(d.monthly_mrr, 0) as subscription_amount,
    'active'::client_status as status,
    COALESCE(d.stage_changed_at, d.created_at) as subscription_start_date,
    NOW() as created_at,
    NOW() as updated_at
FROM deals d
LEFT JOIN clients c ON c.deal_id = d.id
WHERE d.status = 'won' 
  AND c.id IS NULL  -- Only insert where no client record exists
ON CONFLICT (deal_id) DO NOTHING;  -- Prevent duplicates if deal_id is unique

-- Step 3: Update existing client records to sync with deal data
UPDATE clients 
SET 
    subscription_amount = d.monthly_mrr,
    company_name = d.company,
    updated_at = NOW()
FROM deals d 
WHERE clients.deal_id = d.id 
  AND d.status = 'won'
  AND (
    clients.subscription_amount != COALESCE(d.monthly_mrr, 0) OR
    clients.company_name != d.company OR
    clients.subscription_amount IS NULL
  );

-- Step 4: Verify results
DO $$
DECLARE
    total_won_deals INTEGER;
    deals_with_clients INTEGER;
    missing_clients INTEGER;
    viewpoint_deals INTEGER;
    viewpoint_clients INTEGER;
BEGIN
    -- Count total won deals
    SELECT COUNT(*) INTO total_won_deals FROM deals WHERE status = 'won';
    
    -- Count won deals with client records
    SELECT COUNT(*) INTO deals_with_clients 
    FROM deals d 
    INNER JOIN clients c ON c.deal_id = d.id 
    WHERE d.status = 'won';
    
    missing_clients := total_won_deals - deals_with_clients;
    
    -- Check Viewpoint specifically
    SELECT COUNT(*) INTO viewpoint_deals 
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%viewpoint%';
    
    SELECT COUNT(*) INTO viewpoint_clients 
    FROM clients c 
    INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%viewpoint%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ FINAL RESULTS:';
    RAISE NOTICE 'Total won deals: %', total_won_deals;
    RAISE NOTICE 'Deals with clients: %', deals_with_clients;
    RAISE NOTICE 'Missing client records: %', missing_clients;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 VIEWPOINT SPECIFIC:';
    RAISE NOTICE 'Viewpoint won deals: %', viewpoint_deals;
    RAISE NOTICE 'Viewpoint client records: %', viewpoint_clients;
    RAISE NOTICE '';
    
    IF missing_clients = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: All won deals now have client records!';
    ELSE
        RAISE NOTICE '⚠️  WARNING: % deals still missing client records', missing_clients;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 5: Show sample of what we created
DO $$
BEGIN
    RAISE NOTICE '📋 SAMPLE OF NEWLY CREATED CLIENT RECORDS:';
END $$;

SELECT 
    c.company_name,
    c.deal_id,
    d.name as deal_name,
    c.subscription_amount,
    c.status,
    c.created_at
FROM clients c
INNER JOIN deals d ON d.id = c.deal_id
WHERE d.status = 'won'
  AND c.created_at > NOW() - INTERVAL '1 minute'  -- Recently created
ORDER BY c.company_name, c.created_at
LIMIT 10;