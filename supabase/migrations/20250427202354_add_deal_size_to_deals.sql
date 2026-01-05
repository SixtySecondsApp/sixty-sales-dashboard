-- Add deal_size column to deals table
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'deal_size'
    ) THEN
      ALTER TABLE deals ADD COLUMN deal_size TEXT NULL;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping migration - deals table does not exist';
  END IF;
END $$;
