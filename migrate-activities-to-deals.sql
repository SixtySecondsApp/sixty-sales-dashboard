-- Migration Script: Link Activities to Pipeline Deals
-- This script will link existing activities to pipeline deals and create missing deals for orphaned sales

-- First, let's see what we're working with
SELECT 
    'Current Activities' as summary,
    COUNT(*) as total_activities,
    COUNT(CASE WHEN type = 'sale' THEN 1 END) as sales,
    COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meetings,
    COUNT(CASE WHEN type = 'proposal' THEN 1 END) as proposals,
    COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as already_linked
FROM activities;

-- Show current deals
SELECT 
    'Current Deals' as summary,
    COUNT(*) as total_deals,
    COUNT(CASE WHEN deal_stages.name ILIKE '%closed%' OR deal_stages.name ILIKE '%won%' OR deal_stages.name ILIKE '%signed%' THEN 1 END) as closed_deals
FROM deals
LEFT JOIN deal_stages ON deals.stage_id = deal_stages.id;

-- Step 1: Link activities to existing deals by client name matching
UPDATE activities 
SET deal_id = deals.id
FROM deals
WHERE activities.deal_id IS NULL
  AND activities.client_name IS NOT NULL
  AND deals.company IS NOT NULL
  AND (
    LOWER(activities.client_name) = LOWER(deals.company) OR
    LOWER(activities.client_name) LIKE '%' || LOWER(deals.company) || '%' OR
    LOWER(deals.company) LIKE '%' || LOWER(activities.client_name) || '%'
  );

-- Check progress after Step 1
SELECT 
    'After Step 1 - Name Matching' as summary,
    COUNT(*) as total_activities,
    COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as linked_activities,
    COUNT(CASE WHEN deal_id IS NULL AND type = 'sale' THEN 1 END) as unlinked_sales
FROM activities;

-- Step 2: Create deals for unlinked sales
-- First, ensure we have a "Closed Won" stage
INSERT INTO deal_stages (name, color, order_position, default_probability)
SELECT 'Closed Won', 'emerald', 
       COALESCE((SELECT MAX(order_position) + 1 FROM deal_stages), 1), 
       100
WHERE NOT EXISTS (
    SELECT 1 FROM deal_stages 
    WHERE name ILIKE '%closed%' OR name ILIKE '%won%' OR name ILIKE '%signed%'
);

-- Get the closed won stage ID
DO $$
DECLARE
    closed_stage_id uuid;
    activity_record RECORD;
    new_deal_id uuid;
BEGIN
    -- Find the closed won stage
    SELECT id INTO closed_stage_id 
    FROM deal_stages 
    WHERE name ILIKE '%closed%' OR name ILIKE '%won%' OR name ILIKE '%signed%'
    ORDER BY order_position DESC 
    LIMIT 1;
    
    -- If no closed stage, use the last stage
    IF closed_stage_id IS NULL THEN
        SELECT id INTO closed_stage_id 
        FROM deal_stages 
        ORDER BY order_position DESC 
        LIMIT 1;
    END IF;
    
    -- Create deals for unlinked sales
    FOR activity_record IN 
        SELECT DISTINCT ON (client_name, user_id) 
               id, client_name, amount, date, user_id, details
        FROM activities 
        WHERE deal_id IS NULL 
          AND type = 'sale' 
          AND client_name IS NOT NULL
          AND amount > 0
        ORDER BY client_name, user_id, date DESC
    LOOP
        -- Create new deal
        INSERT INTO deals (
            name, company, value, stage_id, owner_id, 
            probability, status, expected_close_date,
            one_off_revenue, monthly_mrr,
            created_at, updated_at
        ) VALUES (
            activity_record.client_name || ' - Sale',
            activity_record.client_name,
            activity_record.amount,
            closed_stage_id,
            activity_record.user_id,
            100,
            'active',
            activity_record.date,
            CASE WHEN activity_record.details ILIKE '%subscription%' THEN NULL ELSE activity_record.amount END,
            CASE WHEN activity_record.details ILIKE '%subscription%' THEN activity_record.amount ELSE NULL END,
            NOW(),
            NOW()
        ) RETURNING id INTO new_deal_id;
        
        -- Link all activities for this client to the new deal
        UPDATE activities 
        SET deal_id = new_deal_id
        WHERE deal_id IS NULL 
          AND client_name = activity_record.client_name
          AND user_id = activity_record.user_id;
          
        RAISE NOTICE 'Created deal % for client % and linked activities', new_deal_id, activity_record.client_name;
    END LOOP;
END $$;

-- Step 3: Link remaining activities by email matching
UPDATE activities 
SET deal_id = subquery.deal_id
FROM (
    SELECT DISTINCT 
        a.id as activity_id,
        d.id as deal_id
    FROM activities a
    JOIN deals d ON (
        a.contact_identifier IS NOT NULL 
        AND d.contact_email IS NOT NULL
        AND LOWER(a.contact_identifier) = LOWER(d.contact_email)
    )
    WHERE a.deal_id IS NULL
) subquery
WHERE activities.id = subquery.activity_id;

-- Step 4: Final report
SELECT 
    'FINAL RESULTS' as summary,
    COUNT(*) as total_activities,
    COUNT(CASE WHEN type = 'sale' THEN 1 END) as total_sales,
    COUNT(CASE WHEN type = 'meeting' THEN 1 END) as total_meetings,
    COUNT(CASE WHEN type = 'proposal' THEN 1 END) as total_proposals,
    COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as linked_activities,
    COUNT(CASE WHEN deal_id IS NULL THEN 1 END) as unlinked_activities,
    ROUND(COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as link_percentage
FROM activities;

-- Show new deals created
SELECT 
    'NEW DEALS CREATED' as summary,
    COUNT(*) as new_deals_count,
    SUM(value) as total_value,
    COUNT(CASE WHEN monthly_mrr IS NOT NULL THEN 1 END) as subscription_deals,
    COUNT(CASE WHEN one_off_revenue IS NOT NULL THEN 1 END) as one_off_deals
FROM deals 
WHERE created_at >= NOW() - INTERVAL '1 hour';

-- Show activity-deal linkage by type
SELECT 
    type,
    COUNT(*) as total,
    COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) as linked,
    COUNT(CASE WHEN deal_id IS NULL THEN 1 END) as unlinked,
    ROUND(COUNT(CASE WHEN deal_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as link_percentage
FROM activities
GROUP BY type
ORDER BY type;

-- Show deals with their linked activities
SELECT 
    d.name as deal_name,
    d.company,
    d.value,
    ds.name as stage,
    COUNT(a.id) as linked_activities,
    STRING_AGG(DISTINCT a.type, ', ') as activity_types
FROM deals d
LEFT JOIN deal_stages ds ON d.stage_id = ds.id
LEFT JOIN activities a ON a.deal_id = d.id
WHERE d.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY d.id, d.name, d.company, d.value, ds.name
ORDER BY d.created_at DESC;