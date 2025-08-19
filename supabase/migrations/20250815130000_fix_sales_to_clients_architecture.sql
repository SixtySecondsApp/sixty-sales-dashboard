-- Fix Sales to Clients Architecture Migration
-- This migration ensures proper data flow: Activities → Deals → Clients

-- Step 1: First run the duplicate deal fix if not already done
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Check if we still have duplicate deal IDs
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT deal_id
        FROM activities 
        WHERE type = 'sale' 
          AND status = 'completed' 
          AND deal_id IS NOT NULL
        GROUP BY deal_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % deal IDs with multiple activities. Running duplicate fix...', duplicate_count;
        
        -- Fix duplicate deals inline
        DECLARE
            rec RECORD;
            activity_rec RECORD;
            new_deal_id UUID;
            company_id_val UUID;
            activity_count INTEGER := 0;
        BEGIN
            -- Loop through each deal_id that has multiple activities
            FOR rec IN 
                SELECT deal_id, COUNT(*) as cnt
                FROM activities 
                WHERE type = 'sale' 
                  AND status = 'completed' 
                  AND deal_id IS NOT NULL
                GROUP BY deal_id
                HAVING COUNT(*) > 1
            LOOP
                RAISE NOTICE 'Processing deal_id: % (% activities)', rec.deal_id, rec.cnt;
                
                -- Get activities for this deal_id, ordered by date (oldest first)
                FOR activity_rec IN 
                    SELECT *
                    FROM activities 
                    WHERE deal_id = rec.deal_id 
                      AND type = 'sale' 
                      AND status = 'completed'
                    ORDER BY date ASC
                LOOP
                    activity_count := activity_count + 1;
                    
                    -- Skip the first (oldest) activity - it keeps the original deal
                    IF activity_count = 1 THEN
                        RAISE NOTICE '  Keeping original: % (%)', activity_rec.client_name, activity_rec.date;
                        CONTINUE;
                    END IF;
                    
                    RAISE NOTICE '  Creating new deal for: % (%)', activity_rec.client_name, activity_rec.date;
                    
                    -- Check if company exists
                    SELECT id INTO company_id_val
                    FROM companies 
                    WHERE LOWER(name) = LOWER(TRIM(activity_rec.client_name))
                    LIMIT 1;
                    
                    -- Create company if it doesn't exist
                    IF company_id_val IS NULL THEN
                        INSERT INTO companies (name, domain, size, industry, website, linkedin_url, created_at, updated_at)
                        VALUES (
                            TRIM(activity_rec.client_name),
                            '',
                            'unknown',
                            'unknown',
                            '',
                            '',
                            NOW(),
                            NOW()
                        )
                        RETURNING id INTO company_id_val;
                        
                        RAISE NOTICE '    Created company: %', TRIM(activity_rec.client_name);
                    END IF;
                    
                    -- Generate new deal ID
                    new_deal_id := gen_random_uuid();
                    
                    -- Create new deal based on original deal but with unique ID
                    INSERT INTO deals (
                        id, name, company, company_id, contact_name, contact_email, contact_phone,
                        value, one_off_revenue, monthly_mrr, annual_value, description,
                        stage_id, owner_id, expected_close_date, first_billing_date,
                        probability, status, priority, deal_size, lead_source_type,
                        lead_source_channel, next_steps, created_at, updated_at, stage_changed_at
                    )
                    SELECT 
                        new_deal_id,
                        activity_rec.client_name || ' - ' || TO_CHAR(activity_rec.date, 'Mon DD, YYYY'),
                        activity_rec.client_name,
                        company_id_val,
                        d.contact_name, d.contact_email, d.contact_phone,
                        COALESCE(activity_rec.amount, d.value),
                        d.one_off_revenue, d.monthly_mrr, d.annual_value,
                        'Deal for ' || activity_rec.client_name || ' signed on ' || TO_CHAR(activity_rec.date, 'Mon DD, YYYY'),
                        d.stage_id, d.owner_id, d.expected_close_date, d.first_billing_date,
                        100, 'won', d.priority, d.deal_size, d.lead_source_type,
                        d.lead_source_channel, 'Deal completed',
                        activity_rec.date, NOW(), activity_rec.date
                    FROM deals d
                    WHERE d.id = rec.deal_id;
                    
                    -- Update activity to point to new deal
                    UPDATE activities 
                    SET deal_id = new_deal_id, updated_at = NOW()
                    WHERE id = activity_rec.id;
                    
                    RAISE NOTICE '    Created deal: %', new_deal_id;
                END LOOP;
                
                -- Reset counter for next deal_id
                activity_count := 0;
                
                -- Update original deal to ensure it has company_id
                UPDATE deals 
                SET company_id = company_id_val, updated_at = NOW()
                WHERE id = rec.deal_id AND company_id IS NULL;
            END LOOP;
        END;
    ELSE
        RAISE NOTICE 'No duplicate deal IDs found. Proceeding with clients table setup.';
    END IF;
END $$;

-- Step 2: Ensure all sale activities have a deal_id
DO $$
DECLARE
    orphan_activity RECORD;
    new_deal_id UUID;
    company_id_val UUID;
    orphan_count INTEGER;
BEGIN
    -- Count orphaned activities
    SELECT COUNT(*) INTO orphan_count
    FROM activities 
    WHERE type = 'sale' 
      AND status = 'completed' 
      AND deal_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Found % sale activities without deal_id. Creating deals...', orphan_count;
        
        -- Create deals for orphaned sale activities
        FOR orphan_activity IN 
            SELECT * FROM activities 
            WHERE type = 'sale' 
              AND status = 'completed' 
              AND deal_id IS NULL
            ORDER BY date ASC
        LOOP
            -- Check if company exists
            SELECT id INTO company_id_val
            FROM companies 
            WHERE LOWER(name) = LOWER(TRIM(orphan_activity.client_name))
            LIMIT 1;
            
            -- Create company if it doesn't exist
            IF company_id_val IS NULL THEN
                INSERT INTO companies (name, domain, size, industry, website, linkedin_url, created_at, updated_at)
                VALUES (
                    TRIM(orphan_activity.client_name),
                    '',
                    'unknown',
                    'unknown',
                    '',
                    '',
                    NOW(),
                    NOW()
                )
                RETURNING id INTO company_id_val;
            END IF;
            
            -- Generate new deal ID
            new_deal_id := gen_random_uuid();
            
            -- Create deal for this activity
            INSERT INTO deals (
                id, name, company, company_id, contact_name, value, one_off_revenue,
                monthly_mrr, annual_value, description, stage_id, owner_id,
                probability, status, priority, created_at, updated_at, stage_changed_at
            ) VALUES (
                new_deal_id,
                orphan_activity.client_name || ' - ' || TO_CHAR(orphan_activity.date, 'Mon DD, YYYY'),
                orphan_activity.client_name,
                company_id_val,
                orphan_activity.client_name,
                COALESCE(orphan_activity.amount, 0),
                CASE WHEN orphan_activity.activity_type = 'one-off' THEN orphan_activity.amount ELSE 0 END,
                CASE WHEN orphan_activity.activity_type = 'subscription' THEN orphan_activity.amount ELSE 0 END,
                CASE WHEN orphan_activity.activity_type = 'subscription' THEN orphan_activity.amount * 12 ELSE 0 END,
                'Deal created from sale activity on ' || TO_CHAR(orphan_activity.date, 'Mon DD, YYYY'),
                (SELECT id FROM deal_stages WHERE name = 'Closed Won' LIMIT 1),
                orphan_activity.owner_id,
                100,
                'won',
                'medium',
                orphan_activity.date,
                NOW(),
                orphan_activity.date
            );
            
            -- Link activity to deal
            UPDATE activities 
            SET deal_id = new_deal_id, updated_at = NOW()
            WHERE id = orphan_activity.id;
            
            RAISE NOTICE 'Created deal % for activity %', new_deal_id, orphan_activity.id;
        END LOOP;
    ELSE
        RAISE NOTICE 'All sale activities already have deal_id.';
    END IF;
END $$;

-- Step 3: Populate clients table from signed/won deals
INSERT INTO clients (
    id,
    company_name,
    contact_name,
    contact_email,
    subscription_amount,
    status,
    deal_id,
    owner_id,
    subscription_start_date,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    d.company,
    d.contact_name,
    d.contact_email,
    COALESCE(d.monthly_mrr, 0),
    CASE 
        WHEN d.status = 'won' AND d.monthly_mrr > 0 THEN 'active'::client_status
        WHEN d.status = 'won' AND (d.one_off_revenue > 0 OR d.value > 0) THEN 'active'::client_status
        ELSE 'active'::client_status
    END,
    d.id,
    d.owner_id,
    COALESCE(d.first_billing_date, d.stage_changed_at, d.created_at),
    NOW(),
    NOW()
FROM deals d
WHERE d.status = 'won'
  AND NOT EXISTS (
    SELECT 1 FROM clients c WHERE c.deal_id = d.id
  )
ON CONFLICT (deal_id) DO NOTHING;

-- Step 4: Add constraint to ensure unique deal_id in clients
ALTER TABLE clients 
ADD CONSTRAINT unique_deal_conversion 
UNIQUE (deal_id);

-- Step 5: Create function to automatically create client when deal is won
CREATE OR REPLACE FUNCTION create_client_from_won_deal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create client if deal status changed to 'won' and no client exists
    IF NEW.status = 'won' AND (OLD.status IS NULL OR OLD.status != 'won') THEN
        INSERT INTO clients (
            id,
            company_name,
            contact_name,
            contact_email,
            subscription_amount,
            status,
            deal_id,
            owner_id,
            subscription_start_date,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            NEW.company,
            NEW.contact_name,
            NEW.contact_email,
            COALESCE(NEW.monthly_mrr, 0),
            'active'::client_status,
            NEW.id,
            NEW.owner_id,
            COALESCE(NEW.first_billing_date, NEW.stage_changed_at, NOW()),
            NOW(),
            NOW()
        )
        ON CONFLICT (deal_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic client creation
DROP TRIGGER IF EXISTS trigger_create_client_from_won_deal ON deals;
CREATE TRIGGER trigger_create_client_from_won_deal
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION create_client_from_won_deal();

-- Step 6: Update existing clients to have proper MRR values from deals
UPDATE clients c
SET subscription_amount = COALESCE(d.monthly_mrr, 0),
    updated_at = NOW()
FROM deals d
WHERE c.deal_id = d.id
  AND d.monthly_mrr IS NOT NULL
  AND d.monthly_mrr > 0
  AND (c.subscription_amount IS NULL OR c.subscription_amount = 0);

-- Final verification queries
DO $$
DECLARE
    duplicate_count INTEGER;
    orphan_count INTEGER;
    client_count INTEGER;
    mrr_total NUMERIC;
BEGIN
    -- Check for any remaining duplicate deal IDs
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT deal_id
        FROM activities 
        WHERE type = 'sale' AND status = 'completed' AND deal_id IS NOT NULL
        GROUP BY deal_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- Check for orphaned activities
    SELECT COUNT(*) INTO orphan_count
    FROM activities 
    WHERE type = 'sale' AND status = 'completed' AND deal_id IS NULL;
    
    -- Check client count
    SELECT COUNT(*) INTO client_count
    FROM clients;
    
    -- Calculate total MRR
    SELECT COALESCE(SUM(subscription_amount), 0) INTO mrr_total
    FROM clients 
    WHERE status = 'active';
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Duplicate deal IDs remaining: %', duplicate_count;
    RAISE NOTICE 'Orphaned sale activities: %', orphan_count;
    RAISE NOTICE 'Total clients created: %', client_count;
    RAISE NOTICE 'Total MRR: £%', mrr_total;
    
    IF duplicate_count = 0 AND orphan_count = 0 THEN
        RAISE NOTICE 'All data integrity issues resolved!';
    END IF;
END $$;