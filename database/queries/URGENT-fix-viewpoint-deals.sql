-- URGENT: Fix Viewpoint Duplicate Deal IDs
-- Copy and paste this into your Supabase SQL Editor and run it

-- Step 1: Check current situation
SELECT 
  a.id as activity_id,
  a.client_name,
  a.date,
  a.deal_id,
  d.name as deal_name
FROM activities a
LEFT JOIN deals d ON a.deal_id = d.id
WHERE a.client_name ILIKE '%viewpoint%'
  AND a.type = 'sale'
  AND a.status = 'completed'
ORDER BY a.date;

-- Step 2: Create new deal for the newer Viewpoint entry (Aug 2, 2025)
DO $$
DECLARE
  new_deal_id UUID;
  original_deal_id UUID;
  viewpoint_company_id UUID;
  newer_activity_id UUID;
BEGIN
  -- Get the deal ID that both activities are currently sharing
  SELECT deal_id INTO original_deal_id
  FROM activities 
  WHERE client_name ILIKE '%viewpoint%'
    AND type = 'sale' 
    AND status = 'completed'
  LIMIT 1;
  
  -- Get the activity ID for the newer Viewpoint entry (Aug 2, 2025)
  SELECT id INTO newer_activity_id
  FROM activities 
  WHERE client_name = 'Viewpoint'
    AND date = '2025-08-02'
    AND type = 'sale'
    AND status = 'completed'
  LIMIT 1;
  
  -- Create or get Viewpoint company
  INSERT INTO companies (name, domain, size, industry, website, linkedin_url, created_at, updated_at)
  VALUES ('Viewpoint', '', 'unknown', 'unknown', '', '', NOW(), NOW())
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO viewpoint_company_id;
  
  -- If company already existed, get its ID
  IF viewpoint_company_id IS NULL THEN
    SELECT id INTO viewpoint_company_id
    FROM companies 
    WHERE name = 'Viewpoint'
    LIMIT 1;
  END IF;
  
  -- Generate new UUID for the new deal
  new_deal_id := gen_random_uuid();
  
  -- Create new deal for Viewpoint (Aug 2, 2025)
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
    'Viewpoint - Aug 2, 2025',
    'Viewpoint',
    viewpoint_company_id,
    d.contact_name,
    d.contact_email,
    d.contact_phone,
    30000, -- £30,000 as shown in the image
    d.one_off_revenue,
    d.monthly_mrr,
    d.annual_value,
    'Deal for Viewpoint signed on Aug 2, 2025',
    d.stage_id,
    d.owner_id,
    d.expected_close_date,
    d.first_billing_date,
    100,
    'won',
    d.priority,
    d.deal_size,
    d.lead_source_type,
    d.lead_source_channel,
    'Deal completed',
    '2025-08-02'::timestamp,
    NOW(),
    '2025-08-02'::timestamp
  FROM deals d
  WHERE d.id = original_deal_id;
  
  -- Update the newer Viewpoint activity to point to the new deal
  UPDATE activities 
  SET deal_id = new_deal_id,
      updated_at = NOW()
  WHERE id = newer_activity_id;
  
  -- Update the original deal name and link to company
  UPDATE deals 
  SET name = 'Viewpoint VC - Jul 31, 2025',
      company_id = viewpoint_company_id,
      updated_at = NOW()
  WHERE id = original_deal_id;
  
  -- Output the results
  RAISE NOTICE 'SUCCESS: Created new deal % for Viewpoint (Aug 2)', new_deal_id;
  RAISE NOTICE 'Original deal % now for Viewpoint VC (Jul 31)', original_deal_id;
  
END $$;

-- Step 3: Verify the fix worked
SELECT 
  a.id as activity_id,
  a.client_name,
  a.date,
  a.deal_id,
  d.name as deal_name,
  d.company_id,
  c.name as company_name
FROM activities a
LEFT JOIN deals d ON a.deal_id = d.id
LEFT JOIN companies c ON d.company_id = c.id
WHERE a.client_name ILIKE '%viewpoint%'
  AND a.type = 'sale'
  AND a.status = 'completed'
ORDER BY a.date;

-- Final check: No more duplicate deal_ids
SELECT 
  deal_id,
  COUNT(*) as activity_count,
  STRING_AGG(client_name, ', ') as clients
FROM activities 
WHERE type = 'sale' 
  AND status = 'completed' 
  AND deal_id IS NOT NULL
GROUP BY deal_id
HAVING COUNT(*) > 1;