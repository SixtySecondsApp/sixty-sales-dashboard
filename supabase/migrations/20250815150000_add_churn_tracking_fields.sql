-- Add churn tracking fields to clients table
-- For proper churn management with notice and final billing dates

-- Step 1: Add new columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS notice_given_date DATE,
ADD COLUMN IF NOT EXISTS final_billing_date DATE,
ADD COLUMN IF NOT EXISTS churn_reason TEXT;

-- Step 2: Update client status enum to include more statuses
-- First check if the type exists
DO $$
BEGIN
    -- Add new status values if they don't exist
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'signed';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'deposit_paid';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'notice_given';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Step 3: Create function to calculate days until churn
CREATE OR REPLACE FUNCTION get_days_until_churn(final_billing_date DATE)
RETURNS INTEGER AS $$
BEGIN
    IF final_billing_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    RETURN final_billing_date - CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create view for churn analytics
CREATE OR REPLACE VIEW client_churn_analytics AS
SELECT 
    c.id,
    c.company_name,
    c.status,
    c.subscription_amount,
    c.notice_given_date,
    c.final_billing_date,
    c.churn_date,
    c.churn_reason,
    get_days_until_churn(c.final_billing_date) as days_until_final_billing,
    CASE 
        WHEN c.status = 'notice_given' AND c.final_billing_date IS NOT NULL THEN
            CASE 
                WHEN c.final_billing_date > CURRENT_DATE THEN 'Active - Notice Period'
                WHEN c.final_billing_date = CURRENT_DATE THEN 'Final Billing Today'
                ELSE 'Should Be Churned'
            END
        WHEN c.status = 'churned' THEN 'Churned'
        WHEN c.status = 'active' THEN 'Active'
        ELSE c.status::text
    END as churn_status,
    -- Calculate remaining revenue
    CASE 
        WHEN c.status = 'notice_given' AND c.final_billing_date > CURRENT_DATE THEN
            c.subscription_amount * CEIL(EXTRACT(EPOCH FROM (c.final_billing_date - CURRENT_DATE))/30)
        ELSE 0
    END as remaining_revenue_estimate
FROM clients c;

-- Step 5: Create function to auto-churn clients after final billing date
CREATE OR REPLACE FUNCTION auto_churn_expired_clients()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Auto-churn clients whose final billing date has passed
    UPDATE clients 
    SET 
        status = 'churned',
        churn_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE status = 'notice_given'
      AND final_billing_date IS NOT NULL
      AND final_billing_date < CURRENT_DATE
      AND status != 'churned';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
        RAISE NOTICE 'Auto-churned % clients whose final billing date passed', updated_count;
    END IF;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Grant permissions
GRANT SELECT ON client_churn_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_days_until_churn(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_churn_expired_clients() TO authenticated;

-- Step 7: Add comments for documentation
COMMENT ON COLUMN clients.notice_given_date IS 'Date when client gave notice to terminate subscription';
COMMENT ON COLUMN clients.final_billing_date IS 'Date of final billing before subscription ends';
COMMENT ON COLUMN clients.churn_reason IS 'Reason provided for churning (optional)';
COMMENT ON VIEW client_churn_analytics IS 'View for analyzing client churn patterns and remaining revenue';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Churn tracking fields added successfully!';
    RAISE NOTICE '📅 Added: notice_given_date, final_billing_date, churn_reason';
    RAISE NOTICE '📊 Created: client_churn_analytics view';
    RAISE NOTICE '⚡ Created: auto_churn_expired_clients() function';
    RAISE NOTICE '💡 UI can now collect notice and final billing dates';
    RAISE NOTICE '';
END $$;