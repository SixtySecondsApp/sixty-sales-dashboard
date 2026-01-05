/*
  # Fix Duplicate Deal Creation Logic

  1. Problem Statement
    - Current activity processing creates new deals instead of checking for existing ones
    - Need to implement proper deal detection logic before creating new deals
    - Focus on meetings and above activity types

  2. Solution
    - Create improved deal detection function
    - Update activity sync rules with better logic
    - Add functions to prevent duplicate deal creation
    - Works with existing profiles table instead of auth.users

  NOTE: Made conditional for staging compatibility.
*/

DO $$
BEGIN
  -- Only proceed if all required tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deals')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_stages')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities')
  THEN
    -- Function to find existing deal for a contact and owner
    CREATE OR REPLACE FUNCTION find_existing_deal_for_contact(
      p_contact_email TEXT,
      p_owner_id UUID,
      p_activity_type TEXT DEFAULT NULL
    )
    RETURNS UUID AS $func$
    DECLARE
      existing_deal_id UUID;
      target_stage_names TEXT[];
    BEGIN
      -- Define stage names that indicate an active deal
      target_stage_names := ARRAY['Lead', 'SQL', 'Qualified', 'Opportunity', 'Proposal', 'Negotiation'];

      -- First, try to find deal by primary contact
      SELECT d.id INTO existing_deal_id
      FROM deals d
      INNER JOIN contacts c ON d.primary_contact_id = c.id
      INNER JOIN deal_stages ds ON d.stage_id = ds.id
      WHERE c.email = p_contact_email
        AND d.owner_id = p_owner_id
        AND d.status = 'active'
        AND ds.name = ANY(target_stage_names)
      ORDER BY d.updated_at DESC
      LIMIT 1;

      -- If not found by primary contact, try by deal_contacts relationship
      IF existing_deal_id IS NULL THEN
        SELECT d.id INTO existing_deal_id
        FROM deals d
        INNER JOIN deal_contacts dc ON d.id = dc.deal_id
        INNER JOIN contacts c ON dc.contact_id = c.id
        INNER JOIN deal_stages ds ON d.stage_id = ds.id
        WHERE c.email = p_contact_email
          AND d.owner_id = p_owner_id
          AND d.status = 'active'
          AND ds.name = ANY(target_stage_names)
        ORDER BY d.updated_at DESC
        LIMIT 1;
      END IF;

      -- If still not found, try by contact_email field (legacy)
      IF existing_deal_id IS NULL THEN
        SELECT d.id INTO existing_deal_id
        FROM deals d
        INNER JOIN deal_stages ds ON d.stage_id = ds.id
        WHERE d.contact_email = p_contact_email
          AND d.owner_id = p_owner_id
          AND d.status = 'active'
          AND ds.name = ANY(target_stage_names)
        ORDER BY d.updated_at DESC
        LIMIT 1;
      END IF;

      RETURN existing_deal_id;
    END;
    $func$ LANGUAGE plpgsql;

    -- Function to get target stage for activity type
    CREATE OR REPLACE FUNCTION get_target_stage_for_activity(
      p_activity_type TEXT,
      p_owner_id UUID
    )
    RETURNS UUID AS $func$
    DECLARE
      stage_id UUID;
      stage_name TEXT;
    BEGIN
      -- Get the target stage name from sync rules or use defaults
      SELECT asr.target_stage_name INTO stage_name
      FROM activity_sync_rules asr
      WHERE asr.activity_type = p_activity_type
        AND asr.owner_id = p_owner_id
        AND asr.is_active = true;

      -- If no custom rule, use defaults
      IF stage_name IS NULL THEN
        stage_name := CASE p_activity_type
          WHEN 'meeting' THEN 'SQL'
          WHEN 'proposal' THEN 'Opportunity'
          WHEN 'sale' THEN 'Closed Won'
          WHEN 'outbound' THEN 'SQL'
          ELSE 'SQL'
        END;
      END IF;

      -- Get the stage ID
      SELECT ds.id INTO stage_id
      FROM deal_stages ds
      WHERE ds.name = stage_name
      LIMIT 1;

      RETURN stage_id;
    END;
    $func$ LANGUAGE plpgsql;

    -- Function to smart process activity (prevents duplicates)
    CREATE OR REPLACE FUNCTION smart_process_activity(
      p_activity_id UUID,
      p_contact_email TEXT,
      p_activity_type TEXT,
      p_owner_id UUID,
      p_client_name TEXT DEFAULT NULL,
      p_amount DECIMAL DEFAULT NULL
    )
    RETURNS UUID AS $func$
    DECLARE
      existing_deal_id UUID;
      new_deal_id UUID;
      contact_record RECORD;
      company_record RECORD;
      target_stage_id UUID;
      deal_name TEXT;
      should_create_deal BOOLEAN;
    BEGIN
      -- Check if we should auto-create deals for this activity type
      SELECT asr.auto_create_deal INTO should_create_deal
      FROM activity_sync_rules asr
      WHERE asr.activity_type = p_activity_type
        AND asr.owner_id = p_owner_id
        AND asr.is_active = true;

      -- Default to creating deals for meetings and above
      IF should_create_deal IS NULL THEN
        should_create_deal := p_activity_type IN ('meeting', 'proposal', 'sale');
      END IF;

      -- Find existing deal first
      existing_deal_id := find_existing_deal_for_contact(p_contact_email, p_owner_id, p_activity_type);

      IF existing_deal_id IS NOT NULL THEN
        -- Update existing deal if needed
        -- For now, just return the existing deal ID
        RETURN existing_deal_id;
      END IF;

      -- Only create new deal if rules allow it
      IF NOT should_create_deal THEN
        RETURN NULL;
      END IF;

      -- Find or create contact
      SELECT * INTO contact_record
      FROM contacts c
      WHERE c.email = p_contact_email
      LIMIT 1;

      -- If contact doesn't exist, create it
      IF contact_record IS NULL THEN
        -- Extract domain for company matching
        IF p_contact_email LIKE '%@%' THEN
          SELECT * INTO company_record
          FROM companies comp
          WHERE comp.domain = LOWER(SPLIT_PART(p_contact_email, '@', 2))
          LIMIT 1;

          -- Create company if needed
          IF company_record IS NULL AND p_client_name IS NOT NULL THEN
            INSERT INTO companies (name, domain, owner_id)
            VALUES (
              p_client_name,
              LOWER(SPLIT_PART(p_contact_email, '@', 2)),
              p_owner_id
            )
            RETURNING * INTO company_record;
          END IF;
        END IF;

        -- Create contact
        INSERT INTO contacts (email, company_id, owner_id, is_primary)
        VALUES (
          p_contact_email,
          company_record.id,
          p_owner_id,
          true -- First contact for company is primary
        )
        RETURNING * INTO contact_record;
      END IF;

      -- Get target stage for deal
      target_stage_id := get_target_stage_for_activity(p_activity_type, p_owner_id);

      -- Create deal name
      deal_name := COALESCE(p_client_name, 'Deal for ' || p_contact_email);

      -- Create new deal
      INSERT INTO deals (
        name,
        company_id,
        primary_contact_id,
        contact_email, -- Keep for legacy compatibility
        value,
        stage_id,
        owner_id,
        description
      )
      VALUES (
        deal_name,
        contact_record.company_id,
        contact_record.id,
        p_contact_email,
        COALESCE(p_amount, 0),
        target_stage_id,
        p_owner_id,
        'Auto-created from activity ' || p_activity_id
      )
      RETURNING id INTO new_deal_id;

      -- Create deal-contact relationship if deal_contacts exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_contacts') THEN
        INSERT INTO deal_contacts (deal_id, contact_id, role)
        VALUES (new_deal_id, contact_record.id, 'decision_maker')
        ON CONFLICT (deal_id, contact_id) DO NOTHING;
      END IF;

      -- Update activity with relationships
      UPDATE activities
      SET
        contact_id = contact_record.id,
        company_id = contact_record.company_id,
        deal_id = new_deal_id,
        auto_matched = true
      WHERE id = p_activity_id;

      RETURN new_deal_id;
    END;
    $func$ LANGUAGE plpgsql;

    -- Update activity sync rules to prevent aggressive deal creation (if table exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_sync_rules') THEN
      UPDATE activity_sync_rules
      SET auto_create_deal = false
      WHERE activity_type = 'outbound';

      -- Update activity sync rules for meetings to use the new logic
      UPDATE activity_sync_rules
      SET auto_create_deal = true
      WHERE activity_type IN ('meeting', 'proposal');
    END IF;

    -- Create index for faster deal lookups
    CREATE INDEX IF NOT EXISTS idx_deals_contact_email_owner_active
    ON deals(contact_email, owner_id, status)
    WHERE status = 'active';

    RAISE NOTICE 'Duplicate deal logic functions created successfully';
  ELSE
    RAISE NOTICE 'Skipping migration - required tables do not exist yet';
  END IF;
END $$;
