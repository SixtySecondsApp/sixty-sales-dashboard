-- Comprehensive sync: Activities → Deals → Payment Records
-- This ensures ALL completed sale activities have corresponding payment tracking

-- Step 1: Analyze current situation across all clients with multiple deals
DO $$
DECLARE
    total_sale_activities INTEGER;
    activities_with_deals INTEGER;
    deals_with_payments INTEGER;
BEGIN
    -- Count completed sale activities
    SELECT COUNT(*) INTO total_sale_activities 
    FROM activities 
    WHERE type = 'sale' AND status = 'completed';
    
    -- Count activities that have deal_id
    SELECT COUNT(*) INTO activities_with_deals 
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' AND deal_id IS NOT NULL;
    
    -- Count deals with payment records
    SELECT COUNT(*) INTO deals_with_payments
    FROM deals d
    INNER JOIN clients c ON c.deal_id = d.id
    WHERE d.status = 'won';
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 COMPREHENSIVE PAYMENT TRACKING ANALYSIS:';
    RAISE NOTICE 'Total completed sale activities: %', total_sale_activities;
    RAISE NOTICE 'Activities with deal_id: %', activities_with_deals;
    RAISE NOTICE 'Deals with payment records: %', deals_with_payments;
    RAISE NOTICE '';
END $$;

-- Step 2: Show clients with multiple deals that might be missing payment records
SELECT 
    'MULTIPLE DEALS ANALYSIS' as section,
    a.company_name,
    COUNT(*) as activity_count,
    STRING_AGG(DISTINCT a.amount::text, ', ') as amounts,
    STRING_AGG(DISTINCT COALESCE(d.name, 'NO DEAL'), ', ') as deal_names
FROM activities a
LEFT JOIN deals d ON d.id = a.deal_id
WHERE a.type = 'sale' AND a.status = 'completed'
GROUP BY a.company_name
HAVING COUNT(*) > 1
ORDER BY activity_count DESC;

-- Step 3: Create payment records for ALL won deals that don't have them
-- (This catches ALL missing deals including Viewpoint, Talent Shore, Clarion, etc.)
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
    CASE 
        WHEN d.monthly_mrr > 0 THEN 'active'::client_status
        ELSE 'signed'::client_status
    END as status,
    COALESCE(d.stage_changed_at, d.created_at) as subscription_start_date,
    NOW() as created_at,
    NOW() as updated_at
FROM deals d
LEFT JOIN clients c ON c.deal_id = d.id
WHERE d.status = 'won' 
  AND c.id IS NULL  -- Only create where payment record doesn't exist
ON CONFLICT (deal_id) DO NOTHING;

-- Step 4: Verify specific multi-deal clients now have correct payment records
DO $$
DECLARE
    viewpoint_deals INTEGER;
    viewpoint_payments INTEGER;
    talent_shore_deals INTEGER;
    talent_shore_payments INTEGER;
    clarion_deals INTEGER;
    clarion_payments INTEGER;
    konnect_deals INTEGER;
    konnect_payments INTEGER;
BEGIN
    -- Viewpoint variations
    SELECT COUNT(*) INTO viewpoint_deals
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%viewpoint%';
    SELECT COUNT(*) INTO viewpoint_payments
    FROM clients c INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%viewpoint%';
    
    -- Talent Shore
    SELECT COUNT(*) INTO talent_shore_deals
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%talent shore%';
    SELECT COUNT(*) INTO talent_shore_payments
    FROM clients c INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%talent shore%';
    
    -- Clarion
    SELECT COUNT(*) INTO clarion_deals
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%clarion%';
    SELECT COUNT(*) INTO clarion_payments
    FROM clients c INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%clarion%';
    
    -- Konnect Marketing
    SELECT COUNT(*) INTO konnect_deals
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%konnect%';
    SELECT COUNT(*) INTO konnect_payments
    FROM clients c INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%konnect%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ MULTI-DEAL CLIENT VERIFICATION:';
    RAISE NOTICE 'Viewpoint: % deals → % payments', viewpoint_deals, viewpoint_payments;
    RAISE NOTICE 'Talent Shore: % deals → % payments', talent_shore_deals, talent_shore_payments;
    RAISE NOTICE 'Clarion: % deals → % payments', clarion_deals, clarion_payments;
    RAISE NOTICE 'Konnect Marketing: % deals → % payments', konnect_deals, konnect_payments;
    RAISE NOTICE '';
    
    IF (viewpoint_deals = viewpoint_payments AND 
        talent_shore_deals = talent_shore_payments AND 
        clarion_deals = clarion_payments AND 
        konnect_deals = konnect_payments) THEN
        RAISE NOTICE '🎉 SUCCESS: All multi-deal clients now have complete payment records!';
        RAISE NOTICE '📋 Each deal should now show as a separate payment row';
    ELSE
        RAISE NOTICE '⚠️  Some clients still have missing payment records';
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 5: Show sample of what we should see in the payments table
SELECT 
    c.company_name,
    d.name as deal_name,
    d.one_off_revenue,
    c.subscription_amount as monthly_mrr,
    CASE 
        WHEN c.subscription_amount > 0 THEN 'Subscription'
        ELSE 'One-off Invoice'
    END as payment_type,
    c.status,
    c.created_at
FROM clients c
INNER JOIN deals d ON d.id = c.deal_id
WHERE d.status = 'won'
  AND (
    LOWER(c.company_name) LIKE '%viewpoint%' OR
    LOWER(c.company_name) LIKE '%talent shore%' OR
    LOWER(c.company_name) LIKE '%clarion%' OR
    LOWER(c.company_name) LIKE '%konnect%'
  )
ORDER BY c.company_name, c.created_at;