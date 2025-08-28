-- Fix Client Status Issues - Comprehensive Update
-- This script addresses the following issues:
-- 1. Updates all 'Signed' statuses to 'Active'
-- 2. Updates 'Active Subscriptions' to 'Subscribed' (but this status doesn't exist yet)
-- 3. Ensures consistency between deal revenue types and client statuses

BEGIN;

-- Step 1: Add 'subscribed' status to the client_status enum if it doesn't exist
DO $$
BEGIN
    -- Check if 'subscribed' status exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'subscribed' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'client_status')) THEN
        ALTER TYPE client_status ADD VALUE 'subscribed';
        RAISE NOTICE 'Added subscribed status to client_status enum';
    ELSE
        RAISE NOTICE 'subscribed status already exists in client_status enum';
    END IF;
END $$;

-- Step 2: Update all existing 'signed' statuses to 'active'
UPDATE clients 
SET 
    status = 'active'::client_status,
    updated_at = NOW()
WHERE status = 'signed'::client_status;

-- Get count of updated records
DO $$
DECLARE
    signed_to_active_count INTEGER;
BEGIN
    GET DIAGNOSTICS signed_to_active_count = ROW_COUNT;
    RAISE NOTICE 'Updated % clients from signed to active status', signed_to_active_count;
END $$;

-- Step 3: Update clients with monthly recurring revenue to 'subscribed' status
-- This identifies clients who should be 'subscribed' based on their deal having monthly_mrr > 0
UPDATE clients 
SET 
    status = 'subscribed'::client_status,
    updated_at = NOW()
FROM deals d
WHERE clients.deal_id = d.id 
  AND d.monthly_mrr > 0 
  AND clients.status = 'active'::client_status;

-- Get count of updated records
DO $$
DECLARE
    active_to_subscribed_count INTEGER;
BEGIN
    GET DIAGNOSTICS active_to_subscribed_count = ROW_COUNT;
    RAISE NOTICE 'Updated % clients from active to subscribed status (based on monthly MRR)', active_to_subscribed_count;
END $$;

-- Step 4: Update clients with only one-off revenue to stay 'active'
-- Ensure clients with only one-off deals remain as 'active'
UPDATE clients 
SET 
    status = 'active'::client_status,
    updated_at = NOW()
FROM deals d
WHERE clients.deal_id = d.id 
  AND (d.monthly_mrr IS NULL OR d.monthly_mrr = 0)
  AND d.one_off_revenue > 0
  AND clients.status != 'active'::client_status
  AND clients.status NOT IN ('churned'::client_status, 'paused'::client_status, 'notice_given'::client_status);

-- Get count of updated records
DO $$
DECLARE
    oneoff_to_active_count INTEGER;
BEGIN
    GET DIAGNOSTICS oneoff_to_active_count = ROW_COUNT;
    RAISE NOTICE 'Updated % clients to active status (one-off revenue only)', oneoff_to_active_count;
END $$;

-- Step 5: Update subscription amounts to match deal monthly_mrr
UPDATE clients 
SET 
    subscription_amount = COALESCE(d.monthly_mrr, 0),
    updated_at = NOW()
FROM deals d
WHERE clients.deal_id = d.id 
  AND clients.subscription_amount != COALESCE(d.monthly_mrr, 0);

-- Get count of updated records
DO $$
DECLARE
    subscription_amount_count INTEGER;
BEGIN
    GET DIAGNOSTICS subscription_amount_count = ROW_COUNT;
    RAISE NOTICE 'Updated subscription amounts for % clients to match deal MRR', subscription_amount_count;
END $$;

-- Step 6: Create a summary report
DO $$
DECLARE
    total_clients INTEGER;
    active_clients INTEGER;
    subscribed_clients INTEGER;
    signed_clients INTEGER;
    churned_clients INTEGER;
    paused_clients INTEGER;
    notice_given_clients INTEGER;
    deposit_paid_clients INTEGER;
BEGIN
    -- Count clients by status
    SELECT COUNT(*) INTO total_clients FROM clients;
    SELECT COUNT(*) INTO active_clients FROM clients WHERE status = 'active'::client_status;
    SELECT COUNT(*) INTO subscribed_clients FROM clients WHERE status = 'subscribed'::client_status;
    SELECT COUNT(*) INTO signed_clients FROM clients WHERE status = 'signed'::client_status;
    SELECT COUNT(*) INTO churned_clients FROM clients WHERE status = 'churned'::client_status;
    SELECT COUNT(*) INTO paused_clients FROM clients WHERE status = 'paused'::client_status;
    SELECT COUNT(*) INTO notice_given_clients FROM clients WHERE status = 'notice_given'::client_status;
    SELECT COUNT(*) INTO deposit_paid_clients FROM clients WHERE status = 'deposit_paid'::client_status;
    
    RAISE NOTICE '=== CLIENT STATUS SUMMARY ===';
    RAISE NOTICE 'Total clients: %', total_clients;
    RAISE NOTICE 'Active clients: %', active_clients;
    RAISE NOTICE 'Subscribed clients: %', subscribed_clients;
    RAISE NOTICE 'Signed clients: %', signed_clients;
    RAISE NOTICE 'Churned clients: %', churned_clients;
    RAISE NOTICE 'Paused clients: %', paused_clients;
    RAISE NOTICE 'Notice given clients: %', notice_given_clients;
    RAISE NOTICE 'Deposit paid clients: %', deposit_paid_clients;
    RAISE NOTICE '============================';
END $$;

COMMIT;

-- Verification queries (uncomment to run manually)
-- SELECT 'Clients with monthly MRR (should be subscribed)' as check_type, 
--        c.company_name, c.status, d.monthly_mrr, d.one_off_revenue
-- FROM clients c 
-- JOIN deals d ON c.deal_id = d.id 
-- WHERE d.monthly_mrr > 0;

-- SELECT 'Clients with only one-off revenue (should be active)' as check_type,
--        c.company_name, c.status, d.monthly_mrr, d.one_off_revenue
-- FROM clients c 
-- JOIN deals d ON c.deal_id = d.id 
-- WHERE (d.monthly_mrr IS NULL OR d.monthly_mrr = 0) AND d.one_off_revenue > 0;

