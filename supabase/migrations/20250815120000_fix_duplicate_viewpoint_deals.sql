/*
  # Fix Duplicate Viewpoint Deals Issue
  
  Problem: Multiple sale activities point to the same deal_id, causing editing one to affect the other.
  Solution: Create separate deals for each unique sale activity and update references.
  
  This ensures each sale activity has its own unique deal that can be edited independently.
*/

-- First, let's check current state
DO $$
DECLARE
    activity_record RECORD;
    new_deal_id UUID;
    existing_deal RECORD;
BEGIN
    -- Find all sale activities that share deal_ids with other activities
    FOR activity_record IN 
        SELECT DISTINCT a1.id, a1.client_name, a1.deal_id, a1.amount, a1.date, a1.sales_rep, a1.details
        FROM activities a1
        WHERE a1.type = 'sale' 
          AND a1.status = 'completed'
          AND a1.deal_id IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM activities a2 
              WHERE a2.id != a1.id 
                AND a2.deal_id = a1.deal_id 
                AND a2.type = 'sale' 
                AND a2.status = 'completed'
          )
        ORDER BY a1.date DESC
    LOOP
        -- Get the existing deal details
        SELECT * INTO existing_deal FROM deals WHERE id = activity_record.deal_id;
        
        -- Create a new unique deal for this activity (except for the first one - keep original)
        -- Only create new deal if this isn't the oldest activity with this deal_id
        IF NOT EXISTS (
            SELECT 1 FROM activities 
            WHERE deal_id = activity_record.deal_id 
              AND type = 'sale' 
              AND status = 'completed' 
              AND date < activity_record.date
        ) THEN
            -- This is the oldest activity, keep the existing deal
            CONTINUE;
        END IF;
        
        -- Generate new UUID for the new deal
        new_deal_id := gen_random_uuid();
        
        -- Create a new deal based on the existing one but with unique ID
        INSERT INTO deals (
            id,
            name,
            company,
            contact_name,
            contact_email,
            contact_phone,
            value,
            one_off_revenue,
            monthly_mrr,
            annual_value,
            description,
            stage_id,
            owner_id,
            expected_close_date,
            first_billing_date,
            probability,
            status,
            priority,
            deal_size,
            lead_source_type,
            lead_source_channel,
            next_steps,
            created_at,
            updated_at,
            stage_changed_at
        )
        SELECT 
            new_deal_id,
            CASE 
                WHEN activity_record.client_name != existing_deal.company 
                THEN activity_record.client_name || ' Deal'
                ELSE existing_deal.name || ' (Copy)'
            END,
            COALESCE(activity_record.client_name, existing_deal.company),
            existing_deal.contact_name,
            existing_deal.contact_email,
            existing_deal.contact_phone,
            COALESCE(activity_record.amount, existing_deal.value),
            existing_deal.one_off_revenue,
            existing_deal.monthly_mrr,
            existing_deal.annual_value,
            existing_deal.description || ' (Generated from activity: ' || activity_record.details || ')',
            existing_deal.stage_id,
            existing_deal.owner_id,
            existing_deal.expected_close_date,
            existing_deal.first_billing_date,
            existing_deal.probability,
            'won', -- Set as won since it's a completed sale
            existing_deal.priority,
            existing_deal.deal_size,
            existing_deal.lead_source_type,
            existing_deal.lead_source_channel,
            existing_deal.next_steps,
            activity_record.date, -- Use activity date as created_at
            NOW(),
            activity_record.date
        FROM deals 
        WHERE id = activity_record.deal_id;
        
        -- Update the activity to point to the new deal
        UPDATE activities 
        SET deal_id = new_deal_id,
            updated_at = NOW()
        WHERE id = activity_record.id;
        
        -- Log the change
        RAISE NOTICE 'Created new deal % for activity % (client: %)', 
            new_deal_id, activity_record.id, activity_record.client_name;
            
    END LOOP;
    
    RAISE NOTICE 'Migration completed - each sale activity now has its own unique deal';
END $$;