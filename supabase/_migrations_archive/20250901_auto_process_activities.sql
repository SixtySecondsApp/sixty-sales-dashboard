-- =====================================================
-- Auto-Process Activities with Contact Identifiers
-- =====================================================
-- This migration creates an automatic processing system for activities
-- that have contact_identifier (email) to create/update deals automatically
-- without requiring manual "Process" button clicks in the UI

-- Create enhanced function to automatically process activities into deals
CREATE OR REPLACE FUNCTION auto_process_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_company_id UUID;
  v_deal_id UUID;
  v_stage_id UUID;
  v_stage_name TEXT;
  v_deal_name TEXT;
  v_should_process BOOLEAN;
  v_existing_deal_id UUID;
BEGIN
  -- Only process if activity has contact_identifier and is not already processed
  IF NEW.contact_identifier IS NULL OR NEW.contact_identifier = '' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.is_processed = true THEN
    RETURN NEW;
  END IF;
  
  -- Skip outbound activities by default (they don't typically create deals)
  IF NEW.type = 'Outbound' OR NEW.type = 'Outbound Activity' THEN
    RETURN NEW;
  END IF;

  -- Log the processing attempt
  RAISE NOTICE 'Auto-processing activity % with email % and type %', NEW.id, NEW.contact_identifier, NEW.type;

  -- Find or create contact
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE email = NEW.contact_identifier
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Extract company from email domain if possible
    IF NEW.contact_identifier LIKE '%@%' THEN
      SELECT id INTO v_company_id
      FROM companies
      WHERE domain = LOWER(SPLIT_PART(NEW.contact_identifier, '@', 2))
      LIMIT 1;
      
      -- Create company if needed and client_name is provided
      IF v_company_id IS NULL AND NEW.client_name IS NOT NULL THEN
        INSERT INTO companies (name, domain, owner_id)
        VALUES (
          NEW.client_name,
          LOWER(SPLIT_PART(NEW.contact_identifier, '@', 2)),
          NEW.user_id
        )
        ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_company_id;
      END IF;
    END IF;
    
    -- Create contact
    INSERT INTO contacts (email, company_id, owner_id, is_primary, first_name, last_name)
    VALUES (
      NEW.contact_identifier,
      v_company_id,
      NEW.user_id,
      true,
      SPLIT_PART(NEW.contact_identifier, '@', 1), -- Use email prefix as first name if not provided
      NULL
    )
    RETURNING id INTO v_contact_id;
    
    RAISE NOTICE 'Created new contact % for email %', v_contact_id, NEW.contact_identifier;
  END IF;

  -- Update activity with contact and company
  NEW.contact_id := v_contact_id;
  NEW.company_id := v_company_id;

  -- Determine target stage based on activity type
  CASE NEW.type
    WHEN 'sale', 'Sale' THEN 
      v_stage_name := 'Signed';
    WHEN 'meeting', 'Meeting' THEN 
      v_stage_name := 'SQL';
    WHEN 'proposal', 'Proposal' THEN 
      v_stage_name := 'Opportunity';
    WHEN 'demo', 'Demo' THEN 
      v_stage_name := 'Opportunity';
    ELSE 
      v_stage_name := 'SQL'; -- Default to SQL for other activity types
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

  -- If no deal found by email, try by contact_id
  IF v_existing_deal_id IS NULL THEN
    SELECT d.id INTO v_existing_deal_id
    FROM deals d
    WHERE d.primary_contact_id = v_contact_id
      AND d.owner_id = NEW.user_id
      AND d.status = 'active'
    ORDER BY d.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_deal_id IS NOT NULL THEN
    -- Deal exists - update it if needed
    v_deal_id := v_existing_deal_id;
    
    -- Update deal stage if activity suggests progression
    IF NEW.type IN ('sale', 'Sale') THEN
      -- Move to Signed stage and update value if provided
      UPDATE deals
      SET 
        stage_id = v_stage_id,
        stage_changed_at = NOW(),
        value = CASE 
          WHEN NEW.amount IS NOT NULL AND NEW.amount > 0 
          THEN NEW.amount 
          ELSE value 
        END,
        updated_at = NOW()
      WHERE id = v_deal_id
        AND stage_id != v_stage_id; -- Only update if stage is different
        
      RAISE NOTICE 'Updated existing deal % to Signed stage', v_deal_id;
      
    ELSIF NEW.type IN ('proposal', 'Proposal') THEN
      -- Check current stage and potentially move to Opportunity
      UPDATE deals
      SET 
        stage_id = v_stage_id,
        stage_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = v_deal_id
        AND stage_id = (SELECT id FROM deal_stages WHERE name = 'SQL'); -- Only progress from SQL
        
      RAISE NOTICE 'Progressed deal % to Opportunity stage', v_deal_id;
    END IF;
    
  ELSE
    -- No existing deal - create new one for certain activity types
    IF NEW.type IN ('meeting', 'Meeting', 'proposal', 'Proposal', 'sale', 'Sale', 'demo', 'Demo') THEN
      
      -- Create deal name
      v_deal_name := COALESCE(NEW.client_name, 'Deal for ' || NEW.contact_identifier);
      
      -- Create new deal
      INSERT INTO deals (
        name,
        company_id,
        primary_contact_id,
        contact_email,
        value,
        stage_id,
        owner_id,
        status,
        description,
        expected_close_date
      )
      VALUES (
        v_deal_name,
        v_company_id,
        v_contact_id,
        NEW.contact_identifier,
        COALESCE(NEW.amount, 0),
        v_stage_id,
        NEW.user_id,
        'active',
        'Auto-created from ' || NEW.type || ' activity',
        CASE 
          WHEN NEW.type IN ('sale', 'Sale') THEN CURRENT_DATE
          ELSE CURRENT_DATE + INTERVAL '30 days'
        END
      )
      RETURNING id INTO v_deal_id;
      
      -- Create deal-contact relationship
      INSERT INTO deal_contacts (deal_id, contact_id, role)
      VALUES (v_deal_id, v_contact_id, 'decision_maker')
      ON CONFLICT (deal_id, contact_id) DO NOTHING;
      
      RAISE NOTICE 'Created new deal % in stage %', v_deal_id, v_stage_name;
    END IF;
  END IF;

  -- Update activity with deal_id and mark as processed
  IF v_deal_id IS NOT NULL THEN
    NEW.deal_id := v_deal_id;
    NEW.is_processed := true;
    NEW.auto_matched := true;
    
    -- Create deal_activities link if it doesn't exist
    INSERT INTO deal_activities (
      deal_id,
      activity_id,
      user_id,
      activity_type,
      created_at
    )
    VALUES (
      v_deal_id,
      NEW.id,
      NEW.user_id,
      NEW.type,
      NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Linked activity % to deal %', NEW.id, v_deal_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-process activities on INSERT
DROP TRIGGER IF EXISTS trigger_auto_process_activity_insert ON activities;
CREATE TRIGGER trigger_auto_process_activity_insert
  BEFORE INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_activity();

-- Create trigger to auto-process activities on UPDATE (when contact_identifier is added)
DROP TRIGGER IF EXISTS trigger_auto_process_activity_update ON activities;
CREATE TRIGGER trigger_auto_process_activity_update
  BEFORE UPDATE ON activities
  FOR EACH ROW
  WHEN (
    OLD.contact_identifier IS DISTINCT FROM NEW.contact_identifier 
    AND NEW.contact_identifier IS NOT NULL
    AND NEW.is_processed = false
  )
  EXECUTE FUNCTION auto_process_activity();

-- Add missing columns if they don't exist
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT false;

-- Add missing activity_id column to deal_activities if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deal_activities' 
    AND column_name = 'activity_id'
  ) THEN
    ALTER TABLE deal_activities ADD COLUMN activity_id UUID REFERENCES activities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_contact_identifier ON activities(contact_identifier) WHERE contact_identifier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_is_processed ON activities(is_processed) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_activities_type_processed ON activities(type, is_processed);
CREATE INDEX IF NOT EXISTS idx_deal_activities_activity_id ON deal_activities(activity_id);

-- Process existing unprocessed activities with contact_identifier
-- This will retroactively process any activities that should have been processed
DO $$
DECLARE
  v_activity RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Process existing activities that have contact_identifier but aren't processed
  FOR v_activity IN 
    SELECT id, contact_identifier, type, user_id, client_name, amount
    FROM activities
    WHERE contact_identifier IS NOT NULL 
      AND contact_identifier != ''
      AND is_processed = false
      AND type NOT IN ('Outbound', 'Outbound Activity')
    ORDER BY created_at DESC
    LIMIT 100 -- Process first 100 to avoid timeout
  LOOP
    -- Mark for reprocessing by updating the record
    UPDATE activities 
    SET updated_at = NOW()
    WHERE id = v_activity.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Queued % existing activities for automatic processing', v_count;
END $$;

-- Add comment to explain the system
COMMENT ON FUNCTION auto_process_activity() IS 
'Automatically processes activities with contact_identifier (email) to create or update deals.
Maps activity types to deal stages: meeting->SQL, proposal->Opportunity, sale->Signed.
Creates contacts and companies as needed, links activities to deals, and marks them as processed.';

COMMENT ON TRIGGER trigger_auto_process_activity_insert ON activities IS 
'Automatically processes new activities to create/update deals when they have a contact email';

COMMENT ON TRIGGER trigger_auto_process_activity_update ON activities IS 
'Processes activities when contact_identifier is added after initial creation';