-- REBUILD PAYMENT TRACKING - FIXED VERSION
-- Handle required owner_id and other constraints

-- Step 1: Clear existing payment records to start fresh
DO $$
DECLARE
    existing_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_payments FROM clients;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹 STARTING FRESH REBUILD (FIXED):';
    RAISE NOTICE 'Existing payment records to clear: %', existing_payments;
    RAISE NOTICE 'Will rebuild from activities with proper constraints...';
    RAISE NOTICE '';
END $$;

-- Clear existing payment records (keep the table structure)
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;

-- Step 2: Get a default user_id to use as owner_id
-- We'll use the first user from activities as the default owner
DO $$
DECLARE
    default_user_id UUID;
BEGIN
    SELECT user_id INTO default_user_id 
    FROM activities 
    WHERE user_id IS NOT NULL 
    LIMIT 1;
    
    IF default_user_id IS NULL THEN
        RAISE EXCEPTION 'No user_id found in activities table for owner_id';
    END IF;
    
    RAISE NOTICE 'Using default owner_id: %', default_user_id;
END $$;

-- Step 3: Create a function to standardize company names (simplified)
CREATE OR REPLACE FUNCTION standardize_company_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
    IF input_name IS NULL OR input_name = '' THEN
        RETURN input_name;
    END IF;
    
    -- Convert to lowercase and clean up
    input_name := LOWER(TRIM(input_name));
    
    -- Handle common variations
    IF input_name LIKE '%viewpoint%' THEN
        RETURN 'Viewpoint';
    END IF;
    
    IF input_name LIKE '%talent%shore%' OR input_name LIKE '%talentshore%' THEN
        RETURN 'Talent Shore';
    END IF;
    
    IF input_name LIKE '%clarion%' THEN
        RETURN 'Clarion';
    END IF;
    
    IF input_name LIKE '%konnect%' THEN
        RETURN 'Konnect Marketing';
    END IF;
    
    -- For other companies, just clean up spacing and capitalization
    RETURN INITCAP(input_name);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create payment records with proper owner_id
INSERT INTO clients (
    company_name,
    owner_id,
    deal_id,
    subscription_amount,
    status,
    subscription_start_date,
    contact_name,
    created_at,
    updated_at
)
SELECT 
    standardize_company_name(a.client_name) as company_name,
    a.user_id as owner_id,  -- Use the user_id from activities as owner_id
    a.deal_id,
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 
            COALESCE(a.amount, 0)
        ELSE 0
    END as subscription_amount,
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 'active'::client_status
        ELSE 'signed'::client_status
    END as status,
    a.date::date as subscription_start_date,
    a.sales_rep as contact_name,
    NOW() as created_at,
    NOW() as updated_at
FROM activities a
WHERE a.type = 'sale' 
  AND a.status = 'completed'
  AND a.client_name IS NOT NULL
  AND a.client_name != ''
  AND a.user_id IS NOT NULL  -- Ensure we have an owner_id
ORDER BY a.date;

-- Step 5: Update with deal data where deals exist
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

-- Step 6: Verify the results
DO $$
DECLARE
    total_activities INTEGER;
    total_payments INTEGER;
    viewpoint_payments INTEGER;
    talent_shore_payments INTEGER;
    clarion_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_activities 
    FROM activities 
    WHERE type = 'sale' AND status = 'completed'
      AND client_name IS NOT NULL AND client_name != ''
      AND user_id IS NOT NULL;
    
    SELECT COUNT(*) INTO total_payments FROM clients;
    
    SELECT COUNT(*) INTO viewpoint_payments
    FROM clients WHERE company_name = 'Viewpoint';
    
    SELECT COUNT(*) INTO talent_shore_payments
    FROM clients WHERE company_name = 'Talent Shore';
    
    SELECT COUNT(*) INTO clarion_payments
    FROM clients WHERE company_name = 'Clarion';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ REBUILD VERIFICATION:';
    RAISE NOTICE 'Total valid activities: %', total_activities;
    RAISE NOTICE 'Total payment records created: %', total_payments;
    RAISE NOTICE '';
    RAISE NOTICE 'Multi-deal clients:';
    RAISE NOTICE 'Viewpoint: % payments', viewpoint_payments;
    RAISE NOTICE 'Talent Shore: % payments', talent_shore_payments;
    RAISE NOTICE 'Clarion: % payments', clarion_payments;
    RAISE NOTICE '';
    
    IF total_activities = total_payments THEN
        RAISE NOTICE '🎉 SUCCESS: Perfect 1:1 mapping!';
        RAISE NOTICE '📋 Multiple payments per client should now show';
    ELSE
        RAISE NOTICE 'Activities: %, Payments: %', total_activities, total_payments;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 7: Show final results
SELECT 
    c.company_name,
    COUNT(*) as payment_count,
    STRING_AGG(COALESCE(c.subscription_amount::text, '0'), ', ') as amounts,
    MIN(c.subscription_start_date) as first_payment,
    MAX(c.subscription_start_date) as latest_payment
FROM clients c
GROUP BY c.company_name
HAVING COUNT(*) > 1  -- Show only clients with multiple payments
ORDER BY COUNT(*) DESC;

-- Clean up
DROP FUNCTION IF EXISTS standardize_company_name(TEXT);