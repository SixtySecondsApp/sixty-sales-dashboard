-- Fix missing columns in deals table that are referenced by auto_process_activity function
-- This migration ensures the deals table has all required columns

-- Add primary_contact_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'primary_contact_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);
    
    RAISE NOTICE 'Added primary_contact_id column to deals table';
  ELSE
    RAISE NOTICE 'primary_contact_id column already exists in deals table';
  END IF;
END $$;

-- Add company_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE deals ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
    
    RAISE NOTICE 'Added company_id column to deals table';
  ELSE
    RAISE NOTICE 'company_id column already exists in deals table';
  END IF;
END $$;

-- Also fix the auto_process_activity function to handle missing columns gracefully
CREATE OR REPLACE FUNCTION auto_process_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_name TEXT;
  v_stage_id UUID;
  v_existing_deal_id UUID;
  v_new_deal_id UUID;
  v_contact_id UUID;
  v_company_id UUID;
  v_has_primary_contact_column BOOLEAN;
BEGIN
  -- Only process if activity has a contact identifier
  IF NEW.contact_identifier IS NULL OR NEW.contact_identifier = '' THEN
    RETURN NEW;
  END IF;

  -- Only process for specific activity types that should create/update deals
  IF NEW.type NOT IN ('meeting', 'proposal', 'sale') THEN
    RETURN NEW;
  END IF;

  -- Check if primary_contact_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' 
    AND column_name = 'primary_contact_id'
  ) INTO v_has_primary_contact_column;

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
        INSERT INTO companies (name, created_by)
        VALUES (NEW.client_name, NEW.user_id)
        RETURNING id INTO v_company_id;
      END IF;
    END IF;

    -- Create contact
    INSERT INTO contacts (
      email,
      first_name,
      company_id,
      created_by
    ) VALUES (
      LOWER(TRIM(NEW.contact_identifier)),
      COALESCE(NEW.client_name, 'Unknown'),
      v_company_id,
      NEW.user_id
    )
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

  -- Find existing deal for this contact and owner
  SELECT d.id INTO v_existing_deal_id
  FROM deals d
  WHERE d.contact_email = NEW.contact_identifier
    AND d.owner_id = NEW.user_id
    AND d.status = 'active'
  ORDER BY d.updated_at DESC
  LIMIT 1;

  -- If no deal found by email and we have primary_contact_id column, try by contact_id
  IF v_existing_deal_id IS NULL AND v_has_primary_contact_column AND v_contact_id IS NOT NULL THEN
    EXECUTE format('
      SELECT d.id 
      FROM deals d
      WHERE d.primary_contact_id = $1
        AND d.owner_id = $2
        AND d.status = ''active''
      ORDER BY d.updated_at DESC
      LIMIT 1
    ') INTO v_existing_deal_id USING v_contact_id, NEW.user_id;
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
    
    -- Update deal with contact and company if we have them and columns exist
    IF v_has_primary_contact_column THEN
      EXECUTE format('
        UPDATE deals 
        SET primary_contact_id = $1, company_id = $2
        WHERE id = $3
      ') USING v_contact_id, v_company_id, v_new_deal_id;
    END IF;
  END IF;

  -- Mark activity as processed
  NEW.is_processed := true;
  NEW.auto_matched := true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers to use the updated function
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

-- Add comment for documentation
COMMENT ON FUNCTION auto_process_activity() IS 'Automatically processes activities to create or update deals based on contact information. Handles missing columns gracefully.';