-- Ensure ALL won deals have corresponding payment records
-- This will create payment records for any won deals that are missing them
-- PAYMENTS TABLE = tracks both subscription payments AND one-off invoice payments

-- Step 1: Check current situation
DO $$
DECLARE
    total_won_deals INTEGER;
    deals_with_payments INTEGER;
    missing_payments INTEGER;
BEGIN
    -- Count total won deals
    SELECT COUNT(*) INTO total_won_deals FROM deals WHERE status = 'won';
    
    -- Count won deals with payment records
    SELECT COUNT(*) INTO deals_with_payments 
    FROM deals d 
    INNER JOIN clients c ON c.deal_id = d.id 
    WHERE d.status = 'won';
    
    missing_payments := total_won_deals - deals_with_payments;
    
    RAISE NOTICE '';
    RAISE NOTICE '💰 CURRENT PAYMENT TRACKING SITUATION:';
    RAISE NOTICE 'Total won deals: %', total_won_deals;
    RAISE NOTICE 'Deals with payment records: %', deals_with_payments;
    RAISE NOTICE 'Missing payment records: %', missing_payments;
    RAISE NOTICE '';
END $$;

-- Step 2: Create payment records for ALL won deals that don't have them
-- NOTE: Using existing 'clients' table structure but treating it as payments tracking
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
    COALESCE(d.monthly_mrr, 0) as subscription_amount,  -- For recurring payments
    CASE 
        WHEN d.monthly_mrr > 0 THEN 'active'::client_status  -- Recurring subscription
        ELSE 'signed'::client_status  -- One-off payment
    END as status,
    COALESCE(d.stage_changed_at, d.created_at) as subscription_start_date,
    NOW() as created_at,
    NOW() as updated_at
FROM deals d
LEFT JOIN clients c ON c.deal_id = d.id
WHERE d.status = 'won' 
  AND c.id IS NULL  -- Only insert where no payment record exists
ON CONFLICT (deal_id) DO NOTHING;  -- Prevent duplicates if deal_id is unique

-- Step 3: Update existing payment records to sync with deal data
UPDATE clients 
SET 
    subscription_amount = d.monthly_mrr,
    company_name = d.company,
    status = CASE 
        WHEN d.monthly_mrr > 0 THEN 'active'::client_status  -- Recurring subscription
        WHEN status = 'active' AND (d.monthly_mrr IS NULL OR d.monthly_mrr = 0) THEN 'signed'::client_status  -- One-off payment
        ELSE status  -- Keep existing status if not changing type
    END,
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
    deals_with_payments INTEGER;
    missing_payments INTEGER;
    viewpoint_deals INTEGER;
    viewpoint_payments INTEGER;
    subscription_payments INTEGER;
    oneoff_payments INTEGER;
BEGIN
    -- Count total won deals
    SELECT COUNT(*) INTO total_won_deals FROM deals WHERE status = 'won';
    
    -- Count won deals with payment records
    SELECT COUNT(*) INTO deals_with_payments 
    FROM deals d 
    INNER JOIN clients c ON c.deal_id = d.id 
    WHERE d.status = 'won';
    
    missing_payments := total_won_deals - deals_with_payments;
    
    -- Count payment types
    SELECT COUNT(*) INTO subscription_payments 
    FROM clients c 
    INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND c.subscription_amount > 0;
    
    SELECT COUNT(*) INTO oneoff_payments 
    FROM clients c 
    INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND (c.subscription_amount IS NULL OR c.subscription_amount = 0);
    
    -- Check Viewpoint specifically
    SELECT COUNT(*) INTO viewpoint_deals 
    FROM deals WHERE status = 'won' AND LOWER(company) LIKE '%viewpoint%';
    
    SELECT COUNT(*) INTO viewpoint_payments 
    FROM clients c 
    INNER JOIN deals d ON d.id = c.deal_id 
    WHERE d.status = 'won' AND LOWER(c.company_name) LIKE '%viewpoint%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ FINAL PAYMENT TRACKING RESULTS:';
    RAISE NOTICE 'Total won deals: %', total_won_deals;
    RAISE NOTICE 'Deals with payment records: %', deals_with_payments;
    RAISE NOTICE 'Missing payment records: %', missing_payments;
    RAISE NOTICE '';
    RAISE NOTICE '💳 PAYMENT TYPE BREAKDOWN:';
    RAISE NOTICE 'Subscription payments (recurring): %', subscription_payments;
    RAISE NOTICE 'One-off payments (invoices): %', oneoff_payments;
    RAISE NOTICE '';
    RAISE NOTICE '🎯 VIEWPOINT SPECIFIC:';
    RAISE NOTICE 'Viewpoint won deals: %', viewpoint_deals;
    RAISE NOTICE 'Viewpoint payment records: %', viewpoint_payments;
    RAISE NOTICE '';
    
    IF missing_payments = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: All won deals now have payment tracking records!';
        RAISE NOTICE '💰 Both subscription and one-off payments are tracked';
    ELSE
        RAISE NOTICE '⚠️  WARNING: % deals still missing payment records', missing_payments;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 5: Show sample of what we created
DO $$
BEGIN
    RAISE NOTICE '📋 SAMPLE OF PAYMENT RECORDS:';
END $$;

SELECT 
    c.company_name,
    c.deal_id,
    d.name as deal_name,
    c.subscription_amount as monthly_recurring,
    d.one_off_revenue,
    CASE 
        WHEN c.subscription_amount > 0 THEN 'Subscription'
        ELSE 'One-off Invoice'
    END as payment_type,
    c.status,
    c.created_at
FROM clients c
INNER JOIN deals d ON d.id = c.deal_id
WHERE d.status = 'won'
ORDER BY c.company_name, c.created_at
LIMIT 15;