/*
  # Add first billing date to deals table

  This migration adds a first_billing_date field to track when
  billing should start for closed deals.

  NOTE: Made conditional for staging compatibility.
*/

DO $$
BEGIN
  -- Only add column if deals table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    -- Add first_billing_date column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'deals'
        AND column_name = 'first_billing_date'
    ) THEN
      ALTER TABLE deals ADD COLUMN first_billing_date DATE;
      COMMENT ON COLUMN deals.first_billing_date IS 'The date when billing/invoicing should begin for this closed deal';
      RAISE NOTICE 'Added first_billing_date column to deals table';
    ELSE
      RAISE NOTICE 'first_billing_date column already exists in deals table';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping migration - deals table does not exist';
  END IF;
END $$;
