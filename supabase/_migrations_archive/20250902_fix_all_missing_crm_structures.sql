-- Comprehensive fix for all missing CRM structures
-- This migration ensures all required tables and columns exist for the QuickAdd and activity processing features

-- 1. First ensure companies table exists (required for foreign keys)
-- Note: Using owner_id instead of created_by to match existing schema
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  website TEXT,
  industry TEXT,
  size TEXT,
  owner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handle duplicate company names before adding unique constraint
DO $$
DECLARE
  v_dup_group RECORD;
  v_dup_company RECORD;
  v_counter INTEGER;
BEGIN
  -- First, handle any duplicate company names by appending a number
  FOR v_dup_group IN 
    SELECT name, COUNT(*) as cnt
    FROM companies
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    v_counter := 2; -- Start numbering from 2 (first one stays unchanged)
    -- Update all but the first occurrence
    FOR v_dup_company IN 
      SELECT id
      FROM companies 
      WHERE name = v_dup_group.name 
      ORDER BY created_at, id  -- Add id as secondary sort for consistency
      OFFSET 1  -- Skip the first one
    LOOP
      UPDATE companies 
      SET name = v_dup_group.name || ' (' || v_counter || ')'
      WHERE id = v_dup_company.id;
      v_counter := v_counter + 1;
    END LOOP;
  END LOOP;

  -- Now add the unique constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_name_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN 
    RAISE NOTICE 'Unique constraint already exists or still has duplicates';
END $$;

-- 2. Ensure contacts table exists (required for foreign keys)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES profiles(id),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add full_name computed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE contacts 
    ADD COLUMN full_name TEXT GENERATED ALWAYS AS (
      CASE 
        WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
        WHEN first_name IS NOT NULL THEN first_name
        WHEN last_name IS NOT NULL THEN last_name
        ELSE NULL
      END
    ) STORED;
  END IF;
END $$;

-- 3. Create activity_sync_rules table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_sync_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('sale', 'outbound', 'meeting', 'proposal')),
  min_priority TEXT DEFAULT 'medium' CHECK (min_priority IN ('low', 'medium', 'high')),
  auto_create_deal BOOLEAN DEFAULT false,
  target_stage_name TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(activity_type, owner_id)
);

-- 4. Add missing columns to deals table
DO $$ 
BEGIN
  -- Add primary_contact_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'primary_contact_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);
    RAISE NOTICE 'Added primary_contact_id column to deals table';
  END IF;

  -- Add company_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
    RAISE NOTICE 'Added company_id column to deals table';
  END IF;
END $$;

-- 5. Add missing columns to activities table
DO $$ 
BEGIN
  -- Add company_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
    RAISE NOTICE 'Added company_id column to activities table';
  END IF;

  -- Add contact_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
    RAISE NOTICE 'Added contact_id column to activities table';
  END IF;

  -- Add deal_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'deal_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
    RAISE NOTICE 'Added deal_id column to activities table';
  END IF;

  -- Add auto_matched if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'auto_matched'
  ) THEN
    ALTER TABLE activities ADD COLUMN auto_matched BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added auto_matched column to activities table';
  END IF;

  -- Add is_processed if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' 
    AND column_name = 'is_processed'
  ) THEN
    ALTER TABLE activities ADD COLUMN is_processed BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added is_processed column to activities table';
  END IF;
END $$;

-- 6. Insert default activity sync rules if table is empty
INSERT INTO activity_sync_rules (activity_type, min_priority, auto_create_deal, target_stage_name, owner_id, is_active)
SELECT 
  activity_type,
  'medium' as min_priority,
  CASE 
    WHEN activity_type = 'meeting' THEN true
    WHEN activity_type = 'proposal' THEN true
    WHEN activity_type = 'sale' THEN true
    ELSE false
  END as auto_create_deal,
  CASE 
    WHEN activity_type = 'meeting' THEN 'SQL'
    WHEN activity_type = 'proposal' THEN 'Opportunity'
    WHEN activity_type = 'sale' THEN 'Signed'
    ELSE NULL
  END as target_stage_name,
  p.id as owner_id,
  true as is_active
FROM 
  (VALUES ('meeting'), ('proposal'), ('sale'), ('outbound')) AS t(activity_type),
  profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM activity_sync_rules WHERE owner_id = p.id
)
ON CONFLICT (activity_type, owner_id) DO NOTHING;

-- 7. Enable RLS on new tables if not already enabled
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_sync_rules ENABLE ROW LEVEL SECURITY;

-- 8. Create basic RLS policies if they don't exist
DO $$ 
BEGIN
  -- Companies policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'Companies are viewable by all authenticated users'
  ) THEN
    CREATE POLICY "Companies are viewable by all authenticated users" 
      ON companies FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'Users can create companies'
  ) THEN
    CREATE POLICY "Users can create companies" 
      ON companies FOR INSERT 
      TO authenticated 
      WITH CHECK (true);  -- Allow all authenticated users to create companies
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'companies' 
    AND policyname = 'Users can update their own companies'
  ) THEN
    CREATE POLICY "Users can update their own companies" 
      ON companies FOR UPDATE 
      TO authenticated 
      USING (owner_id = auth.uid() OR owner_id IS NULL)
      WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
  END IF;

  -- Contacts policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contacts' 
    AND policyname = 'Contacts are viewable by all authenticated users'
  ) THEN
    CREATE POLICY "Contacts are viewable by all authenticated users" 
      ON contacts FOR SELECT 
      TO authenticated 
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contacts' 
    AND policyname = 'Users can create contacts'
  ) THEN
    CREATE POLICY "Users can create contacts" 
      ON contacts FOR INSERT 
      TO authenticated 
      WITH CHECK (true);  -- Allow all authenticated users to create contacts
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'contacts' 
    AND policyname = 'Users can update their own contacts'
  ) THEN
    CREATE POLICY "Users can update their own contacts" 
      ON contacts FOR UPDATE 
      TO authenticated 
      USING (owner_id = auth.uid() OR owner_id IS NULL)
      WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);
  END IF;

  -- Activity sync rules policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_sync_rules' 
    AND policyname = 'Users can view their own sync rules'
  ) THEN
    CREATE POLICY "Users can view their own sync rules" 
      ON activity_sync_rules FOR SELECT 
      TO authenticated 
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'activity_sync_rules' 
    AND policyname = 'Users can manage their own sync rules'
  ) THEN
    CREATE POLICY "Users can manage their own sync rules" 
      ON activity_sync_rules FOR ALL 
      TO authenticated 
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 9. Create or replace the auto_process_activity function with better error handling
CREATE OR REPLACE FUNCTION auto_process_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_name TEXT;
  v_stage_id UUID;
  v_existing_deal_id UUID;
  v_new_deal_id UUID;
  v_contact_id UUID;
  v_company_id UUID;
BEGIN
  -- Only process if activity has a contact identifier
  IF NEW.contact_identifier IS NULL OR NEW.contact_identifier = '' THEN
    RETURN NEW;
  END IF;

  -- Only process for specific activity types that should create/update deals
  IF NEW.type NOT IN ('meeting', 'proposal', 'sale') THEN
    RETURN NEW;
  END IF;

  -- Try to find existing contact
  IF NEW.contact_identifier_type = 'email' THEN
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts 
    WHERE email = LOWER(TRIM(NEW.contact_identifier))
    LIMIT 1;
  ELSIF NEW.contact_identifier_type = 'phone' THEN
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts 
    WHERE phone = NEW.contact_identifier
    LIMIT 1;
  END IF;

  -- If no contact found, create one
  IF v_contact_id IS NULL AND NEW.contact_identifier_type = 'email' THEN
    -- Try to find or create company first
    IF NEW.client_name IS NOT NULL AND NEW.client_name != '' THEN
      SELECT id INTO v_company_id
      FROM companies 
      WHERE LOWER(name) = LOWER(TRIM(NEW.client_name))
      LIMIT 1;
      
      IF v_company_id IS NULL THEN
        INSERT INTO companies (name, owner_id)
        VALUES (NEW.client_name, NEW.user_id)
        ON CONFLICT (name) DO NOTHING
        RETURNING id INTO v_company_id;
      END IF;
    END IF;

    -- Create contact
    INSERT INTO contacts (
      email,
      first_name,
      company_id,
      owner_id
    ) VALUES (
      LOWER(TRIM(NEW.contact_identifier)),
      COALESCE(NEW.client_name, 'Unknown'),
      v_company_id,
      NEW.user_id
    )
    ON CONFLICT (email) DO UPDATE
    SET company_id = COALESCE(contacts.company_id, EXCLUDED.company_id)
    RETURNING id INTO v_contact_id;
  END IF;

  -- Determine the appropriate stage based on activity type
  CASE NEW.type
    WHEN 'meeting' THEN
      v_stage_name := 'SQL';
    WHEN 'proposal' THEN
      v_stage_name := 'Opportunity';
    WHEN 'sale' THEN
      v_stage_name := 'Signed';
    ELSE
      v_stage_name := 'SQL';
  END CASE;

  -- Get the stage ID
  SELECT id INTO v_stage_id
  FROM deal_stages
  WHERE name = v_stage_name
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RAISE WARNING 'Stage % not found in deal_stages table', v_stage_name;
    RETURN NEW;
  END IF;

  -- Find existing deal for this contact and owner by email
  SELECT d.id INTO v_existing_deal_id
  FROM deals d
  WHERE d.contact_email = NEW.contact_identifier
    AND d.owner_id = NEW.user_id
    AND d.status = 'active'
  ORDER BY d.updated_at DESC
  LIMIT 1;

  -- If no deal found by email, try by contact_id (only if column exists)
  IF v_existing_deal_id IS NULL AND v_contact_id IS NOT NULL THEN
    BEGIN
      SELECT d.id INTO v_existing_deal_id
      FROM deals d
      WHERE d.primary_contact_id = v_contact_id
        AND d.owner_id = NEW.user_id
        AND d.status = 'active'
      ORDER BY d.updated_at DESC
      LIMIT 1;
    EXCEPTION
      WHEN undefined_column THEN
        -- Column doesn't exist, skip this check
        NULL;
    END;
  END IF;

  IF v_existing_deal_id IS NOT NULL THEN
    -- Update existing deal
    NEW.deal_id := v_existing_deal_id;
    
    -- Update deal stage if activity suggests progression
    IF NEW.type = 'proposal' THEN
      UPDATE deals 
      SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Opportunity' LIMIT 1),
          updated_at = NOW()
      WHERE id = v_existing_deal_id
        AND stage_id IN (SELECT id FROM deal_stages WHERE name IN ('SQL', 'Lead'));
    ELSIF NEW.type = 'sale' THEN
      UPDATE deals 
      SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed' LIMIT 1),
          updated_at = NOW(),
          value = COALESCE(NEW.amount, value)
      WHERE id = v_existing_deal_id;
    END IF;
  ELSE
    -- Create new deal
    INSERT INTO deals (
      name,
      company,
      contact_email,
      value,
      stage_id,
      owner_id,
      status,
      expected_close_date
    ) VALUES (
      COALESCE(NEW.client_name, 'Unknown') || ' - ' || 
        CASE NEW.type 
          WHEN 'meeting' THEN 'Meeting'
          WHEN 'proposal' THEN 'Proposal'
          WHEN 'sale' THEN 'Sale'
          ELSE NEW.type
        END,
      NEW.client_name,
      NEW.contact_identifier,
      COALESCE(NEW.amount, 0),
      v_stage_id,
      NEW.user_id,
      'active',
      NOW() + INTERVAL '30 days'
    )
    RETURNING id INTO v_new_deal_id;
    
    -- Update activity with new deal_id
    NEW.deal_id := v_new_deal_id;
    
    -- Try to update deal with contact and company (if columns exist)
    BEGIN
      UPDATE deals 
      SET primary_contact_id = v_contact_id, 
          company_id = v_company_id
      WHERE id = v_new_deal_id;
    EXCEPTION
      WHEN undefined_column THEN
        -- Columns don't exist, skip update
        NULL;
    END;
  END IF;

  -- Mark activity as processed
  NEW.is_processed := true;
  NEW.auto_matched := true;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error in auto_process_activity: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Recreate triggers
DROP TRIGGER IF EXISTS trigger_auto_process_activity_insert ON activities;
CREATE TRIGGER trigger_auto_process_activity_insert
  BEFORE INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_activity();

DROP TRIGGER IF EXISTS trigger_auto_process_activity_update ON activities;
CREATE TRIGGER trigger_auto_process_activity_update
  BEFORE UPDATE ON activities
  FOR EACH ROW
  WHEN (
    OLD.contact_identifier IS DISTINCT FROM NEW.contact_identifier 
    AND NEW.contact_identifier IS NOT NULL
    AND OLD.contact_identifier IS NULL
  )
  EXECUTE FUNCTION auto_process_activity();

-- Add helpful comments
COMMENT ON TABLE activity_sync_rules IS 'Rules for automatically creating and managing deals from activities';
COMMENT ON FUNCTION auto_process_activity() IS 'Automatically processes activities to create or update deals based on contact information';

-- Final notice
DO $$
BEGIN
  RAISE NOTICE 'CRM structure fix completed successfully';
END $$;