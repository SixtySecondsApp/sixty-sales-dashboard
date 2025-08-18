-- Fix Duplicate Deals Script
-- Run this in your Supabase SQL Editor to separate duplicate deals

-- First, let's see what we're working with
SELECT 
    'Current situation' as status,
    deal_id,
    COUNT(*) as activity_count,
    STRING_AGG(client_name, ', ') as client_names,
    STRING_AGG(date::text, ', ') as dates
FROM activities 
WHERE type = 'sale' 
  AND status = 'completed' 
  AND deal_id IS NOT NULL
GROUP BY deal_id
HAVING COUNT(*) > 1;

-- Create a function to fix duplicate deals
CREATE OR REPLACE FUNCTION fix_duplicate_deals()
RETURNS TEXT AS $$
DECLARE
    rec RECORD;
    activity_rec RECORD;
    new_deal_id UUID;
    company_id_val UUID;
    result_text TEXT := '';
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
        result_text := result_text || 'Processing deal_id: ' || rec.deal_id || ' (' || rec.cnt || ' activities)' || E'\n';
        
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
                result_text := result_text || '  Keeping original: ' || activity_rec.client_name || ' (' || activity_rec.date || ')' || E'\n';
                CONTINUE;
            END IF;
            
            result_text := result_text || '  Creating new deal for: ' || activity_rec.client_name || ' (' || activity_rec.date || ')' || E'\n';
            
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
                
                result_text := result_text || '    Created company: ' || TRIM(activity_rec.client_name) || E'\n';
            ELSE
                result_text := result_text || '    Found existing company: ' || TRIM(activity_rec.client_name) || E'\n';
            END IF;
            
            -- Generate new deal ID
            new_deal_id := gen_random_uuid();
            
            -- Create new deal based on original deal but with unique ID
            INSERT INTO deals (
                id,
                name,
                company,
                company_id,
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
                activity_rec.client_name || ' - ' || TO_CHAR(activity_rec.date, 'Mon DD, YYYY'),
                activity_rec.client_name,
                company_id_val,
                d.contact_name,
                d.contact_email,
                d.contact_phone,
                COALESCE(activity_rec.amount, d.value),
                d.one_off_revenue,
                d.monthly_mrr,
                d.annual_value,
                'Deal for ' || activity_rec.client_name || ' signed on ' || TO_CHAR(activity_rec.date, 'Mon DD, YYYY') || 
                CASE WHEN activity_rec.details IS NOT NULL THEN ' - ' || activity_rec.details ELSE '' END,
                d.stage_id,
                d.owner_id,
                d.expected_close_date,
                d.first_billing_date,
                100, -- 100% probability since it's completed
                'won', -- Status as won since it's a completed sale
                d.priority,
                d.deal_size,
                d.lead_source_type,
                d.lead_source_channel,
                'Deal completed',
                activity_rec.date,
                NOW(),
                activity_rec.date
            FROM deals d
            WHERE d.id = rec.deal_id;
            
            -- Update activity to point to new deal
            UPDATE activities 
            SET deal_id = new_deal_id,
                updated_at = NOW()
            WHERE id = activity_rec.id;
            
            result_text := result_text || '    Created deal: ' || new_deal_id || E'\n';
            
        END LOOP;
        
        -- Reset counter for next deal_id
        activity_count := 0;
        
        -- Update original deal to ensure it has company_id
        UPDATE deals 
        SET company_id = company_id_val,
            updated_at = NOW()
        WHERE id = rec.deal_id
          AND company_id IS NULL;
        
    END LOOP;
    
    RETURN result_text || E'\nCompleted! Each sale activity now has its own unique deal.';
END;
$$ LANGUAGE plpgsql;

-- Run the function
SELECT fix_duplicate_deals();

-- Verify the results
SELECT 
    'After fix' as status,
    deal_id,
    COUNT(*) as activity_count,
    STRING_AGG(client_name, ', ') as client_names
FROM activities 
WHERE type = 'sale' 
  AND status = 'completed' 
  AND deal_id IS NOT NULL
GROUP BY deal_id
HAVING COUNT(*) > 1;

-- Show new deal structure for Viewpoint
SELECT 
    a.id as activity_id,
    a.client_name,
    a.date as signed_date,
    a.deal_id,
    d.name as deal_name,
    d.company_id,
    c.name as company_name
FROM activities a
JOIN deals d ON a.deal_id = d.id
LEFT JOIN companies c ON d.company_id = c.id
WHERE a.type = 'sale' 
  AND a.status = 'completed'
  AND a.client_name ILIKE '%viewpoint%'
ORDER BY a.date;

-- Clean up the function
DROP FUNCTION fix_duplicate_deals();