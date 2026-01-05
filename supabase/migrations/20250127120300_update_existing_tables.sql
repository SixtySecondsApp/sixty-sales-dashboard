/*
  # Add CRM Relationship Columns to Existing Tables

  1. Updates to existing tables
    - Add `company_id` and `primary_contact_id` to deals table
    - Add `company_id`, `contact_id`, `deal_id`, `auto_matched` to activities table

  2. Indexes and constraints
    - Add indexes for new foreign keys
    - Maintain existing functionality while adding relationships

  NOTE: Made conditional for staging compatibility.
*/

-- Update deals table with new relationship fields (only if deals table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'company_id'
    ) THEN
      -- Only add if companies table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        ALTER TABLE deals ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deals' AND column_name = 'primary_contact_id'
    ) THEN
      -- Only add if contacts table exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
        ALTER TABLE deals ADD COLUMN primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
      END IF;
    END IF;

    -- Create indexes (only if columns exist)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'primary_contact_id') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'contact_email') THEN
      CREATE INDEX IF NOT EXISTS idx_deals_contact_email_owner_active
        ON deals(contact_email, owner_id, status)
        WHERE status = 'active';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping deals updates - deals table does not exist';
  END IF;
END $$;

-- Update activities table with new relationship fields (only if activities table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'company_id'
    ) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        ALTER TABLE activities ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'contact_id'
    ) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts') THEN
        ALTER TABLE activities ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'deal_id'
    ) THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals') THEN
        ALTER TABLE activities ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'activities' AND column_name = 'auto_matched'
    ) THEN
      ALTER TABLE activities ADD COLUMN auto_matched BOOLEAN DEFAULT false;
    END IF;

    -- Create indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'company_id') THEN
      CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'contact_id') THEN
      CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'deal_id') THEN
      CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'auto_matched') THEN
      CREATE INDEX IF NOT EXISTS idx_activities_auto_matched ON activities(auto_matched);
    END IF;
  ELSE
    RAISE NOTICE 'Skipping activities updates - activities table does not exist';
  END IF;
END $$;

-- Insert default activity sync rules for existing users (if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_sync_rules')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    INSERT INTO activity_sync_rules (activity_type, min_priority, auto_create_deal, target_stage_name, owner_id, is_active)
    SELECT
      rule.activity_type,
      rule.min_priority,
      rule.auto_create_deal,
      rule.target_stage_name,
      p.id as owner_id,
      true as is_active
    FROM profiles p
    CROSS JOIN (
      VALUES
        ('meeting', 'medium', true, 'SQL'),
        ('proposal', 'medium', true, 'Opportunity'),
        ('sale', 'low', false, 'Closed Won'),
        ('outbound', 'medium', false, 'SQL')
    ) AS rule(activity_type, min_priority, auto_create_deal, target_stage_name)
    WHERE p.id IS NOT NULL
    ON CONFLICT (activity_type, owner_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipping activity_sync_rules insert - required tables do not exist';
  END IF;
END $$;
