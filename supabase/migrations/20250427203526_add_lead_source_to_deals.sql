-- Add lead_source columns to deals table
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'lead_source_type'
    ) THEN
      ALTER TABLE deals ADD COLUMN lead_source_type TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'lead_source_channel'
    ) THEN
      ALTER TABLE deals ADD COLUMN lead_source_channel TEXT NULL;
    END IF;
  ELSE
    RAISE NOTICE 'Skipping migration - deals table does not exist';
  END IF;
END $$;
