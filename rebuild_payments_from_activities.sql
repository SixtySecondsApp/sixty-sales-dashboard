-- REBUILD PAYMENT TRACKING FROM CLEAN ACTIVITIES DATA
-- Start fresh and convert all completed sale activities to payment records

-- Step 1: Clear existing payment records to start fresh
DO $$
DECLARE
    existing_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_payments FROM clients;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹 STARTING FRESH REBUILD:';
    RAISE NOTICE 'Existing payment records to clear: %', existing_payments;
    RAISE NOTICE 'Will rebuild from clean activities data...';
    RAISE NOTICE '';
END $$;

-- Clear existing payment records (keep the table structure)
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;

-- Step 2: Analyze the clean activities data
SELECT 
    'CLEAN ACTIVITIES ANALYSIS' as section,
    a.company_name,
    COUNT(*) as total_sales,
    STRING_AGG(a.amount::text, ', ') as amounts,
    STRING_AGG(a.details, ', ') as sale_types,
    MIN(a.date) as first_sale,
    MAX(a.date) as latest_sale
FROM activities a
WHERE a.type = 'sale' AND a.status = 'completed'
GROUP BY a.company_name
ORDER BY COUNT(*) DESC, a.company_name;

-- Step 3: Create payment records directly from completed sale activities
-- Each completed sale activity = one payment record
INSERT INTO clients (
    company_name,
    deal_id,
    subscription_amount,
    status,
    subscription_start_date,
    contact_name,
    contact_email,
    created_at,
    updated_at
)
SELECT 
    a.company_name,
    a.deal_id,  -- Link to deal if exists, NULL if not
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 
            CASE 
                WHEN a.amount > 0 THEN a.amount  -- Use activity amount for subscription
                ELSE 0
            END
        ELSE 0  -- One-off sales don't have monthly recurring
    END as subscription_amount,
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 'active'::client_status
        ELSE 'signed'::client_status
    END as status,
    a.date::date as subscription_start_date,
    a.contact_name,
    a.contact_email,
    NOW() as created_at,
    NOW() as updated_at
FROM activities a
WHERE a.type = 'sale' 
  AND a.status = 'completed'
  AND a.company_name IS NOT NULL
  AND a.company_name != ''
ORDER BY a.date;

-- Step 4: Update with deal data where deals exist and link properly
UPDATE clients 
SET 
    subscription_amount = CASE 
        WHEN d.monthly_mrr > 0 THEN d.monthly_mrr
        ELSE clients.subscription_amount
    END,
    updated_at = NOW()
FROM deals d 
WHERE clients.deal_id = d.id 
  AND d.status = 'won';

-- Step 5: Verify the rebuild results
DO $$
DECLARE
    total_activities INTEGER;
    total_payments INTEGER;
    viewpoint_activities INTEGER;
    viewpoint_payments INTEGER;
    talent_shore_activities INTEGER;
    talent_shore_payments INTEGER;
    clarion_activities INTEGER;
    clarion_payments INTEGER;
BEGIN
    -- Count totals
    SELECT COUNT(*) INTO total_activities 
    FROM activities 
    WHERE type = 'sale' AND status = 'completed';
    
    SELECT COUNT(*) INTO total_payments FROM clients;
    
    -- Count multi-deal clients
    SELECT COUNT(*) INTO viewpoint_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(company_name) LIKE '%viewpoint%';
      
    SELECT COUNT(*) INTO viewpoint_payments
    FROM clients 
    WHERE LOWER(company_name) LIKE '%viewpoint%';
    
    SELECT COUNT(*) INTO talent_shore_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(company_name) LIKE '%talent shore%';
      
    SELECT COUNT(*) INTO talent_shore_payments
    FROM clients 
    WHERE LOWER(company_name) LIKE '%talent shore%';
    
    SELECT COUNT(*) INTO clarion_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(company_name) LIKE '%clarion%';
      
    SELECT COUNT(*) INTO clarion_payments
    FROM clients 
    WHERE LOWER(company_name) LIKE '%clarion%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ REBUILD VERIFICATION:';
    RAISE NOTICE 'Total completed sale activities: %', total_activities;
    RAISE NOTICE 'Total payment records created: %', total_payments;
    RAISE NOTICE '';
    RAISE NOTICE 'Multi-deal client verification:';
    RAISE NOTICE 'Viewpoint: % activities → % payments', viewpoint_activities, viewpoint_payments;
    RAISE NOTICE 'Talent Shore: % activities → % payments', talent_shore_activities, talent_shore_payments;
    RAISE NOTICE 'Clarion: % activities → % payments', clarion_activities, clarion_payments;
    RAISE NOTICE '';
    
    IF total_activities = total_payments THEN
        RAISE NOTICE '🎉 SUCCESS: Perfect 1:1 mapping - each sale activity = one payment record!';
        RAISE NOTICE '📋 All multi-deal clients should now show multiple payment rows';
    ELSE
        RAISE NOTICE '⚠️  Mismatch: % activities vs % payments', total_activities, total_payments;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 6: Show sample of rebuilt payment records
SELECT 
    'REBUILT PAYMENTS SAMPLE' as section,
    c.company_name,
    c.subscription_amount as monthly_mrr,
    d.one_off_revenue,
    d.name as deal_name,
    CASE 
        WHEN c.subscription_amount > 0 THEN 'Subscription'
        ELSE 'One-off Invoice'
    END as payment_type,
    c.status,
    c.subscription_start_date,
    c.created_at
FROM clients c
LEFT JOIN deals d ON d.id = c.deal_id
ORDER BY c.company_name, c.subscription_start_date
LIMIT 20;