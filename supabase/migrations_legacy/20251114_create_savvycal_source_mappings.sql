-- Create SavvyCal source mapping table for tracking meeting link IDs to sources
-- This allows us to map SavvyCal booking link IDs to lead sources for conversion tracking

-- Create table with org_id as nullable UUID (no foreign key constraint initially)
-- This allows the table to be created even if organizations table doesn't exist yet
CREATE TABLE IF NOT EXISTS savvycal_source_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT NOT NULL,
  source TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  org_id UUID, -- Will add foreign key constraint later if organizations table exists
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(link_id, org_id)
);

-- Add foreign key constraint to organizations if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations'
  ) THEN
    -- Add foreign key constraint if organizations table exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'savvycal_source_mappings_org_id_fkey'
      AND table_name = 'savvycal_source_mappings'
    ) THEN
      ALTER TABLE savvycal_source_mappings
        ADD CONSTRAINT savvycal_source_mappings_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_link_id ON savvycal_source_mappings(link_id);
CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_org_id ON savvycal_source_mappings(org_id);
CREATE INDEX IF NOT EXISTS idx_savvycal_source_mappings_source ON savvycal_source_mappings(source);

-- Add updated_at trigger
CREATE TRIGGER update_savvycal_source_mappings_updated_at
  BEFORE UPDATE ON savvycal_source_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE savvycal_source_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Use simpler policies that don't depend on can_access_org_data function
-- If org_id is NULL, allow all authenticated users to access
-- If org_id is set, users can access their own mappings or all if they're admins
DO $$
BEGIN
  -- Drop existing policies if they exist (for idempotency)
  DROP POLICY IF EXISTS "Users can view source mappings in their org" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can create source mappings in their org" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can update source mappings in their org" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can delete source mappings in their org" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can view all source mappings" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can create source mappings" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can update source mappings" ON savvycal_source_mappings;
  DROP POLICY IF EXISTS "Users can delete source mappings" ON savvycal_source_mappings;

  -- Check if can_access_org_data function exists
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'can_access_org_data'
  ) THEN
    -- Function exists, use org-based policies
    EXECUTE 'CREATE POLICY "Users can view source mappings in their org"
      ON savvycal_source_mappings FOR SELECT
      TO authenticated
      USING (org_id IS NULL OR can_access_org_data(org_id))';

    EXECUTE 'CREATE POLICY "Users can create source mappings in their org"
      ON savvycal_source_mappings FOR INSERT
      TO authenticated
      WITH CHECK (org_id IS NULL OR can_access_org_data(org_id))';

    EXECUTE 'CREATE POLICY "Users can update source mappings in their org"
      ON savvycal_source_mappings FOR UPDATE
      TO authenticated
      USING (org_id IS NULL OR can_access_org_data(org_id))
      WITH CHECK (org_id IS NULL OR can_access_org_data(org_id))';

    EXECUTE 'CREATE POLICY "Users can delete source mappings in their org"
      ON savvycal_source_mappings FOR DELETE
      TO authenticated
      USING (org_id IS NULL OR can_access_org_data(org_id))';
  ELSE
    -- Function doesn't exist, use simpler user-based policies
    EXECUTE 'CREATE POLICY "Users can view all source mappings"
      ON savvycal_source_mappings FOR SELECT
      TO authenticated
      USING (true)';

    EXECUTE 'CREATE POLICY "Users can create source mappings"
      ON savvycal_source_mappings FOR INSERT
      TO authenticated
      WITH CHECK (created_by = auth.uid() OR created_by IS NULL)';

    EXECUTE 'CREATE POLICY "Users can update source mappings"
      ON savvycal_source_mappings FOR UPDATE
      TO authenticated
      USING (created_by = auth.uid() OR created_by IS NULL)
      WITH CHECK (created_by = auth.uid() OR created_by IS NULL)';

    EXECUTE 'CREATE POLICY "Users can delete source mappings"
      ON savvycal_source_mappings FOR DELETE
      TO authenticated
      USING (created_by = auth.uid() OR created_by IS NULL)';
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE savvycal_source_mappings IS 'Maps SavvyCal booking link IDs to lead sources for conversion tracking';
COMMENT ON COLUMN savvycal_source_mappings.link_id IS 'SavvyCal booking link ID (from CSV link_id column)';
COMMENT ON COLUMN savvycal_source_mappings.source IS 'Lead source name (e.g., "Facebook Ads", "LinkedIn", "Website")';

-- Add columns to deals and activities for SavvyCal tracking (if not exists)
DO $$
BEGIN
  -- Add savvycal_booking_id to deals if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'savvycal_booking_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN savvycal_booking_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_deals_savvycal_booking_id ON deals(savvycal_booking_id) WHERE savvycal_booking_id IS NOT NULL;
  END IF;

  -- Add savvycal_booking_id to activities if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'savvycal_booking_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN savvycal_booking_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_activities_savvycal_booking_id ON activities(savvycal_booking_id) WHERE savvycal_booking_id IS NOT NULL;
  END IF;

  -- Add savvycal_link_id to deals if it doesn't exist (for source mapping)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'savvycal_link_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN savvycal_link_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_deals_savvycal_link_id ON deals(savvycal_link_id) WHERE savvycal_link_id IS NOT NULL;
  END IF;

  -- Add savvycal_link_id to activities if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'savvycal_link_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN savvycal_link_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_activities_savvycal_link_id ON activities(savvycal_link_id) WHERE savvycal_link_id IS NOT NULL;
  END IF;
END $$;

-- Add comments for new columns
COMMENT ON COLUMN deals.savvycal_booking_id IS 'SavvyCal event ID (from CSV id column)';
COMMENT ON COLUMN deals.savvycal_link_id IS 'SavvyCal booking link ID (from CSV link_id column) for source mapping';
COMMENT ON COLUMN activities.savvycal_booking_id IS 'SavvyCal event ID (from CSV id column)';
COMMENT ON COLUMN activities.savvycal_link_id IS 'SavvyCal booking link ID (from CSV link_id column) for source mapping';

