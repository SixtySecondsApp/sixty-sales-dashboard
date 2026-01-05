-- Enable RLS on deal_splits table if not already enabled
-- NOTE: Made conditional for staging compatibility

DO $$
BEGIN
  -- Only proceed if deal_splits table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_splits') THEN

    ALTER TABLE deal_splits ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view all deal splits" ON deal_splits;
    DROP POLICY IF EXISTS "Users can create deal splits" ON deal_splits;
    DROP POLICY IF EXISTS "Users can update own deal splits" ON deal_splits;
    DROP POLICY IF EXISTS "Users can update deal splits" ON deal_splits;
    DROP POLICY IF EXISTS "Only admins can delete deal splits" ON deal_splits;

    -- Policy: All authenticated users can view deal splits
    CREATE POLICY "Users can view all deal splits"
      ON deal_splits FOR SELECT
      TO authenticated
      USING (true);

    -- Policy: All authenticated users can create deal splits
    -- Note: The deal owner check should be done at the application level
    -- since we need to verify they own the deal being split
    CREATE POLICY "Users can create deal splits"
      ON deal_splits FOR INSERT
      TO authenticated
      WITH CHECK (true);

    -- Policy: Users can update their own splits or if they're an admin
    CREATE POLICY "Users can update deal splits"
      ON deal_splits FOR UPDATE
      TO authenticated
      USING (
        user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

    -- Policy: Only admins can delete deal splits
    CREATE POLICY "Only admins can delete deal splits"
      ON deal_splits FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );

    -- Add a comment to explain the policies
    COMMENT ON TABLE deal_splits IS 'Deal splits between users. Any user can create splits, but only admins can delete them.';

    RAISE NOTICE 'deal_splits RLS policies applied successfully';
  ELSE
    RAISE NOTICE 'Skipping deal_splits RLS policies - deal_splits table does not exist';
  END IF;
END $$;
