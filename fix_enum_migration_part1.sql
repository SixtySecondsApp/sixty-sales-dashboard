-- Part 1: Add enum values first (must be committed before use)
-- Run this first, then run Part 2

-- Step 1: Add new columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS notice_given_date DATE,
ADD COLUMN IF NOT EXISTS final_billing_date DATE,
ADD COLUMN IF NOT EXISTS churn_reason TEXT;

-- Step 2: Add new enum values (these need to be committed before use)
DO $$
BEGIN
    -- Add new status values if they don't exist
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'signed';
    EXCEPTION
        WHEN duplicate_object THEN 
            RAISE NOTICE 'Status "signed" already exists';
    END;
    
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'deposit_paid';
    EXCEPTION
        WHEN duplicate_object THEN 
            RAISE NOTICE 'Status "deposit_paid" already exists';
    END;
    
    BEGIN
        ALTER TYPE client_status ADD VALUE IF NOT EXISTS 'notice_given';
    EXCEPTION
        WHEN duplicate_object THEN 
            RAISE NOTICE 'Status "notice_given" already exists';
    END;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Part 1 Complete: Enum values and columns added!';
    RAISE NOTICE '📅 Added columns: notice_given_date, final_billing_date, churn_reason';
    RAISE NOTICE '📋 Added statuses: signed, deposit_paid, notice_given';
    RAISE NOTICE '⚠️  IMPORTANT: Now run Part 2 to create the functions and views';
    RAISE NOTICE '';
END $$;