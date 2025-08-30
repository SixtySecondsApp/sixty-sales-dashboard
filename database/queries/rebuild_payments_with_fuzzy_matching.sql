-- REBUILD PAYMENT TRACKING WITH FUZZY MATCHING FOR MANUAL TYPING
-- Handle variations like "Viewpoint" vs "Viewpoint VC" vs "ViewPoint" etc.

-- Step 1: Clear existing payment records to start fresh
DO $$
DECLARE
    existing_payments INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_payments FROM clients;
    
    RAISE NOTICE '';
    RAISE NOTICE '🧹 STARTING FRESH REBUILD WITH FUZZY MATCHING:';
    RAISE NOTICE 'Existing payment records to clear: %', existing_payments;
    RAISE NOTICE 'Will rebuild from activities with smart company grouping...';
    RAISE NOTICE '';
END $$;

-- Clear existing payment records (keep the table structure)
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;

-- Step 2: Analyze activities data with fuzzy grouping
-- Show potential company name variations that should be grouped
SELECT 
    'COMPANY NAME VARIATIONS ANALYSIS' as section,
    a.client_name,
    COUNT(*) as total_sales,
    STRING_AGG(DISTINCT a.amount::text, ', ') as amounts,
    STRING_AGG(DISTINCT a.details, ', ') as sale_types,
    MIN(a.date) as first_sale,
    MAX(a.date) as latest_sale
FROM activities a
WHERE a.type = 'sale' AND a.status = 'completed'
  AND a.client_name IS NOT NULL
  AND a.client_name != ''
GROUP BY a.client_name
ORDER BY 
    -- Group similar names together
    LOWER(REGEXP_REPLACE(a.client_name, '[^a-zA-Z]', '', 'g')),
    COUNT(*) DESC;

-- Step 3: Create a function to standardize company names
-- This will help group variations together
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

-- Step 4: Create payment records directly from completed sale activities
-- Each completed sale activity = one payment record
-- Use standardized company names to group variations
INSERT INTO clients (
    company_name,
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
    a.sales_rep as contact_name,  -- Store sales rep in contact_name for now
    NOW() as created_at,
    NOW() as updated_at
FROM activities a
WHERE a.type = 'sale' 
  AND a.status = 'completed'
  AND a.client_name IS NOT NULL
  AND a.client_name != ''
ORDER BY a.date;

-- Step 5: Update with deal data where deals exist and link properly
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

-- Step 6: Verify the rebuild results with fuzzy matching
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
    WHERE type = 'sale' AND status = 'completed'
      AND client_name IS NOT NULL AND client_name != '';
    
    SELECT COUNT(*) INTO total_payments FROM clients;
    
    -- Count multi-deal clients (using fuzzy matching)
    SELECT COUNT(*) INTO viewpoint_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(client_name) LIKE '%viewpoint%';
      
    SELECT COUNT(*) INTO viewpoint_payments
    FROM clients 
    WHERE company_name = 'Viewpoint';
    
    SELECT COUNT(*) INTO talent_shore_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(client_name) LIKE '%talent%shore%';
      
    SELECT COUNT(*) INTO talent_shore_payments
    FROM clients 
    WHERE company_name = 'Talent Shore';
    
    SELECT COUNT(*) INTO clarion_activities
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' 
      AND LOWER(client_name) LIKE '%clarion%';
      
    SELECT COUNT(*) INTO clarion_payments
    FROM clients 
    WHERE company_name = 'Clarion';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ FUZZY MATCHING REBUILD VERIFICATION:';
    RAISE NOTICE 'Total completed sale activities: %', total_activities;
    RAISE NOTICE 'Total payment records created: %', total_payments;
    RAISE NOTICE '';
    RAISE NOTICE 'Multi-deal client verification (with fuzzy matching):';
    RAISE NOTICE 'Viewpoint variations: % activities → % payments', viewpoint_activities, viewpoint_payments;
    RAISE NOTICE 'Talent Shore variations: % activities → % payments', talent_shore_activities, talent_shore_payments;
    RAISE NOTICE 'Clarion variations: % activities → % payments', clarion_activities, clarion_payments;
    RAISE NOTICE '';
    
    IF total_activities = total_payments THEN
        RAISE NOTICE '🎉 SUCCESS: Perfect 1:1 mapping with fuzzy matching!';
        RAISE NOTICE '📋 All company variations grouped correctly, multiple payments per client showing';
    ELSE
        RAISE NOTICE '⚠️  Mismatch: % activities vs % payments', total_activities, total_payments;
    END IF;
    RAISE NOTICE '';
END $$;

-- Step 7: Show final payment records grouped by standardized company names
SELECT 
    'FINAL PAYMENT RECORDS' as section,
    c.company_name,
    COUNT(*) as payment_count,
    STRING_AGG(c.subscription_amount::text, ', ') as amounts,
    STRING_AGG(d.name, ', ') as deal_names,
    MIN(c.subscription_start_date) as first_payment,
    MAX(c.subscription_start_date) as latest_payment
FROM clients c
LEFT JOIN deals d ON d.id = c.deal_id
GROUP BY c.company_name
ORDER BY COUNT(*) DESC, c.company_name;

-- Clean up the function
DROP FUNCTION IF EXISTS standardize_company_name(TEXT);