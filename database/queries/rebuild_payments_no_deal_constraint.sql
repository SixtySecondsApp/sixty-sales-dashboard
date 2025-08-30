-- REBUILD PAYMENT TRACKING - AVOID DEAL_ID CONSTRAINT
-- Create payment records without deal_id constraint issues

-- Step 1: Clear existing payment records to start fresh
DO $$
DECLARE
    existing_payments INTEGER;
    default_owner_id UUID;
BEGIN
    SELECT COUNT(*) INTO existing_payments FROM clients;
    
    -- Get a default owner_id from profiles table
    SELECT id INTO default_owner_id FROM profiles LIMIT 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹 STARTING FRESH REBUILD (NO DEAL CONSTRAINT):';
    RAISE NOTICE 'Existing payment records to clear: %', existing_payments;
    RAISE NOTICE 'Default owner_id for activities: %', default_owner_id;
    RAISE NOTICE 'Will create payment records without deal_id constraint...';
    RAISE NOTICE '';
END $$;

-- Clear existing payment records (keep the table structure)
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;

-- Step 2: Create a function to standardize company names
CREATE OR REPLACE FUNCTION standardize_company_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
    IF input_name IS NULL OR input_name = '' THEN
        RETURN input_name;
    END IF;
    
    -- Convert to lowercase and clean up
    input_name := LOWER(TRIM(input_name));
    
    -- Handle common variations
    -- Viewpoint variations
    IF input_name LIKE '%viewpoint%' THEN
        RETURN 'Viewpoint';
    END IF;
    
    -- Talent Shore variations  
    IF input_name LIKE '%talent%shore%' OR input_name LIKE '%talentshore%' THEN
        RETURN 'Talent Shore';
    END IF;
    
    -- Clarion variations
    IF input_name LIKE '%clarion%' THEN
        RETURN 'Clarion';
    END IF;
    
    -- Konnect Marketing variations
    IF input_name LIKE '%konnect%' THEN
        RETURN 'Konnect Marketing';
    END IF;
    
    -- Impact Team variations
    IF input_name LIKE '%impact%team%' OR input_name LIKE '%impactteam%' THEN
        RETURN 'Impact Team';
    END IF;
    
    -- Corporate & Legal variations
    IF input_name LIKE '%corporate%legal%' OR input_name LIKE '%c&l%' THEN
        RETURN 'Corporate & Legal';
    END IF;
    
    -- For other companies, just clean up spacing and capitalization
    RETURN INITCAP(input_name);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create payment records WITHOUT deal_id to avoid constraint
-- Each activity becomes a separate payment record
INSERT INTO clients (
    company_name,
    subscription_amount,
    status,
    subscription_start_date,
    contact_name,
    owner_id,
    created_at,
    updated_at
)
SELECT 
    standardize_company_name(a.client_name) as company_name,
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 
            CASE 
                WHEN a.amount > 0 THEN a.amount
                ELSE 0
            END
        ELSE 0
    END as subscription_amount,
    CASE 
        WHEN a.details LIKE '%subscription%' THEN 'active'::client_status
        ELSE 'signed'::client_status
    END as status,
    a.date::date as subscription_start_date,
    a.sales_rep as contact_name,
    -- Use deal owner if available, otherwise default user
    COALESCE(
        d.owner_id,
        (SELECT id FROM profiles LIMIT 1)
    ) as owner_id,
    NOW() as created_at,
    NOW() as updated_at
FROM activities a
LEFT JOIN deals d ON d.id = a.deal_id
WHERE a.type = 'sale' 
  AND a.status = 'completed'
  AND a.client_name IS NOT NULL
  AND a.client_name != ''
ORDER BY a.date;

-- Step 4: Verify the rebuild results
DO $$
DECLARE
    total_activities INTEGER;
    total_payments INTEGER;
    viewpoint_activities INTEGER;
    viewpoint_payments INTEGER;
    payments_with_owner INTEGER;
BEGIN
    -- Count totals
    SELECT COUNT(*) INTO total_activities 
    FROM activities 
    WHERE type = 'sale' AND status = 'completed'
      AND client_name IS NOT NULL AND client_name != '';
    
    SELECT COUNT(*) INTO total_payments FROM clients;
    
    -- Count payments with proper owner_id
    SELECT COUNT(*) INTO payments_with_owner 
    FROM clients 
    WHERE owner_id IS NOT NULL;
    
    -- Count viewpoint activities vs payments (fuzzy matching test)
    SELECT COUNT(*) INTO viewpoint_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(client_name) LIKE '%viewpoint%';
      
    SELECT COUNT(*) INTO viewpoint_payments
    FROM clients 
    WHERE company_name = 'Viewpoint';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ NO CONSTRAINT REBUILD VERIFICATION:';
    RAISE NOTICE 'Total completed sale activities: %', total_activities;
    RAISE NOTICE 'Total payment records created: %', total_payments;
    RAISE NOTICE 'Payments with valid owner_id: %', payments_with_owner;
    RAISE NOTICE '';
    RAISE NOTICE 'Fuzzy matching test (Viewpoint):';
    RAISE NOTICE 'Viewpoint variations: % activities → % payments', viewpoint_activities, viewpoint_payments;
    RAISE NOTICE '';
    
    IF total_activities = total_payments AND payments_with_owner = total_payments THEN
        RAISE NOTICE '🎉 SUCCESS: Perfect 1:1 mapping without deal constraint!';
        RAISE NOTICE '📋 All activities converted to independent payment records';
    ELSE
        RAISE NOTICE '⚠️  Check: Activities: %, Payments: %, With Owner: %', 
                     total_activities, total_payments, payments_with_owner;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 5: Show final payment records grouped by standardized company names
SELECT 
    'FINAL PAYMENT RECORDS' as section,
    c.company_name,
    COUNT(*) as payment_count,
    STRING_AGG(c.subscription_amount::text, ', ') as amounts,
    MIN(c.subscription_start_date) as first_payment,
    MAX(c.subscription_start_date) as latest_payment,
    STRING_AGG(DISTINCT p.email, ', ') as owners
FROM clients c
LEFT JOIN profiles p ON p.id = c.owner_id
GROUP BY c.company_name
ORDER BY COUNT(*) DESC, c.company_name;

-- Step 6: Show companies with multiple payments (the goal!)
SELECT 
    'MULTI-PAYMENT CLIENTS' as section,
    c.company_name,
    COUNT(*) as payment_count,
    STRING_AGG(c.subscription_amount::text, ', ') as amounts,
    STRING_AGG(c.subscription_start_date::text, ', ') as payment_dates
FROM clients c
GROUP BY c.company_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Clean up the function
DROP FUNCTION IF EXISTS standardize_company_name(TEXT);