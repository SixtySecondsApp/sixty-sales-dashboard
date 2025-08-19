-- Fix MRR sync between deals and clients tables
-- When deals are updated, clients table should reflect the changes

-- Step 1: Check current MRR mismatch
SELECT 
    'MRR Sync Check' as info,
    c.company_name,
    c.subscription_amount as client_mrr,
    d.monthly_mrr as deal_mrr,
    (d.monthly_mrr - c.subscription_amount) as difference
FROM clients c
JOIN deals d ON c.deal_id = d.id
WHERE d.monthly_mrr != c.subscription_amount
ORDER BY ABS(d.monthly_mrr - c.subscription_amount) DESC;

-- Step 2: Update clients table to match deals table MRR
UPDATE clients 
SET 
    subscription_amount = deals.monthly_mrr,
    updated_at = NOW()
FROM deals
WHERE clients.deal_id = deals.id
  AND deals.monthly_mrr IS NOT NULL
  AND deals.monthly_mrr != clients.subscription_amount;

-- Step 3: Create trigger to keep them in sync automatically
CREATE OR REPLACE FUNCTION sync_client_mrr_on_deal_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Update client subscription_amount when deal monthly_mrr changes
    IF NEW.monthly_mrr IS DISTINCT FROM OLD.monthly_mrr THEN
        UPDATE clients 
        SET 
            subscription_amount = NEW.monthly_mrr,
            updated_at = NOW()
        WHERE deal_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_sync_client_mrr ON deals;
CREATE TRIGGER trigger_sync_client_mrr
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION sync_client_mrr_on_deal_update();

-- Step 4: Verification - check if sync worked
SELECT 
    'After Sync Check' as info,
    c.company_name,
    c.subscription_amount as client_mrr,
    d.monthly_mrr as deal_mrr,
    CASE 
        WHEN d.monthly_mrr = c.subscription_amount THEN 'SYNCED ✅'
        ELSE 'MISMATCH ❌'
    END as sync_status
FROM clients c
JOIN deals d ON c.deal_id = d.id
ORDER BY c.company_name;

-- Step 5: Show total MRR calculation
SELECT 
    'Total MRR Calculation' as info,
    SUM(subscription_amount) as total_mrr_from_clients,
    COUNT(*) as active_clients
FROM clients 
WHERE status = 'active'
  AND subscription_amount > 0;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ MRR sync fix applied!';
    RAISE NOTICE '🔄 Clients table now synced with deals table';
    RAISE NOTICE '⚡ Automatic sync trigger created';
    RAISE NOTICE '💡 Refresh your browser to see updated MRR';
    RAISE NOTICE '';
END $$;