-- Create payment records for ALL Viewpoint variations
-- This will catch "Viewpoint", "Viewpoint VC", and any other variations

-- Step 1: Find all Viewpoint variations that are missing payment records
DO $$
DECLARE
    missing_viewpoint_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_viewpoint_payments
    FROM deals d
    LEFT JOIN clients c ON c.deal_id = d.id
    WHERE d.status = 'won' 
      AND LOWER(d.company) LIKE '%viewpoint%'
      AND c.id IS NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 VIEWPOINT PAYMENT ANALYSIS:';
    RAISE NOTICE 'Missing Viewpoint payment records: %', missing_viewpoint_payments;
    RAISE NOTICE '';
END $$;

-- Step 2: Show what Viewpoint deals exist vs what payment records exist
SELECT 
    'DEALS' as type,
    d.company,
    d.name as deal_name,
    d.status,
    d.one_off_revenue,
    d.monthly_mrr,
    'N/A' as payment_status
FROM deals d
WHERE LOWER(d.company) LIKE '%viewpoint%'

UNION ALL

SELECT 
    'PAYMENTS' as type,
    c.company_name as company,
    d.name as deal_name,
    d.status,
    d.one_off_revenue,
    c.subscription_amount as monthly_mrr,
    c.status::text as payment_status
FROM clients c
INNER JOIN deals d ON d.id = c.deal_id
WHERE LOWER(c.company_name) LIKE '%viewpoint%'
ORDER BY type, company;

-- Step 3: Create payment records for ALL missing Viewpoint deals
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
  AND LOWER(d.company) LIKE '%viewpoint%'  -- This will catch both "Viewpoint" and "Viewpoint VC"
  AND c.id IS NULL  -- Only create where payment record doesn't exist
ON CONFLICT (deal_id) DO NOTHING;

-- Step 4: Verify all Viewpoint deals now have payment records
DO $$
DECLARE
    total_viewpoint_deals INTEGER;
    total_viewpoint_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_viewpoint_deals
    FROM deals d
    WHERE d.status = 'won' AND LOWER(d.company) LIKE '%viewpoint%';
    
    SELECT COUNT(*) INTO total_viewpoint_payments
    FROM clients c
    INNER JOIN deals d ON d.id = c.deal_id
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%viewpoint%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ VIEWPOINT VERIFICATION:';
    RAISE NOTICE 'Total Viewpoint won deals: %', total_viewpoint_deals;
    RAISE NOTICE 'Total Viewpoint payment records: %', total_viewpoint_payments;
    
    IF total_viewpoint_deals = total_viewpoint_payments THEN
        RAISE NOTICE '🎉 SUCCESS: All Viewpoint deals now have payment records!';
        RAISE NOTICE '📋 Both "Viewpoint" and "Viewpoint VC" should now show as separate payments';
    ELSE
        RAISE NOTICE '⚠️  Still missing % payment records', (total_viewpoint_deals - total_viewpoint_payments);
    END IF;
    RAISE NOTICE '';
END $$;