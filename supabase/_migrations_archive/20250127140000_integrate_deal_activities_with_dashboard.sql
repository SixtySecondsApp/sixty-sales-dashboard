/*
  # Integrate Deal Activities with Dashboard Activity Tracking
  
  1. Create missing view for deal-activities edge function
  2. Add sync triggers to create main activity records from deal activities
  3. Map activity types between systems for proper dashboard integration
  
  This ensures activities logged in deal modals count towards dashboard metrics.
*/

-- Drop existing view if it exists to avoid column conflicts
DROP VIEW IF EXISTS deal_activities_with_profile;

-- Add contact_email field to deal_activities if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deal_activities' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE deal_activities ADD COLUMN contact_email TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deal_activities' AND column_name = 'is_matched'
  ) THEN
    ALTER TABLE deal_activities ADD COLUMN is_matched BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Create the missing view that the deal-activities edge function expects
CREATE VIEW deal_activities_with_profile AS
SELECT 
  da.id,
  da.deal_id,
  da.user_id,
  da.activity_type,
  da.notes,
  da.due_date,
  da.completed,
  da.created_at,
  da.updated_at,
  da.contact_email,
  da.is_matched,
  p.id as profile_id,
  COALESCE(p.first_name || ' ' || p.last_name, p.email) as profile_full_name,
  p.avatar_url as profile_avatar_url
FROM deal_activities da
LEFT JOIN profiles p ON da.user_id = p.id;

-- Function to map deal activity types to main activity types
CREATE OR REPLACE FUNCTION map_deal_activity_to_main_activity(deal_activity_type TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE deal_activity_type
    WHEN 'call' THEN 'outbound'
    WHEN 'email' THEN 'outbound'  
    WHEN 'meeting' THEN 'meeting'
    WHEN 'task' THEN 'outbound'
    -- Don't sync notes and stage_changes to main activities
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to sync deal activity to main activities table
CREATE OR REPLACE FUNCTION sync_deal_activity_to_main_activities()
RETURNS TRIGGER AS $$
DECLARE
  main_activity_type TEXT;
  deal_record RECORD;
  sales_rep_name TEXT;
BEGIN
  -- Only sync completed activities that map to main activity types
  IF NEW.completed = false THEN
    RETURN NEW;
  END IF;
  
  -- Map the activity type
  main_activity_type := map_deal_activity_to_main_activity(NEW.activity_type);
  
  -- Skip if activity type doesn't map
  IF main_activity_type IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get deal information
  SELECT d.*, c.name as company_name, ct.email as contact_email
  INTO deal_record
  FROM deals d
  LEFT JOIN companies c ON d.company_id = c.id
  LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
  WHERE d.id = NEW.deal_id;
  
  -- Get sales rep name
  SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email)
  INTO sales_rep_name
  FROM profiles p
  WHERE p.id = NEW.user_id;
  
  -- Insert into main activities table
  INSERT INTO activities (
    user_id,
    type,
    status,
    priority,
    client_name,
    sales_rep,
    details,
    amount,
    date,
    created_at,
    updated_at,
    quantity,
    contact_identifier,
    contact_identifier_type,
    company_id,
    contact_id,
    deal_id,
    auto_matched
  ) VALUES (
    NEW.user_id,
    main_activity_type,
    'completed',
    'medium', -- Default priority
    COALESCE(deal_record.company_name, deal_record.company, 'Unknown Company'),
    COALESCE(sales_rep_name, 'Unknown Rep'),
    NEW.notes,
    CASE WHEN main_activity_type = 'meeting' THEN deal_record.value ELSE NULL END,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.created_at, NOW()),
    NOW(),
    1, -- Default quantity
    COALESCE(NEW.contact_email, deal_record.contact_email),
    CASE WHEN COALESCE(NEW.contact_email, deal_record.contact_email) IS NOT NULL THEN 'email' ELSE NULL END,
    deal_record.company_id,
    deal_record.primary_contact_id,
    NEW.deal_id,
    true -- Auto-matched since it came from deal
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync deal activities to main activities
DROP TRIGGER IF EXISTS sync_deal_activity_trigger ON deal_activities;
CREATE TRIGGER sync_deal_activity_trigger
  AFTER INSERT OR UPDATE ON deal_activities
  FOR EACH ROW
  EXECUTE FUNCTION sync_deal_activity_to_main_activities();

-- Add index for the view performance
CREATE INDEX IF NOT EXISTS idx_deal_activities_user_id ON deal_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id_created ON deal_activities(deal_id, created_at DESC);

-- Grant permissions on the view
GRANT SELECT ON deal_activities_with_profile TO authenticated;

-- Update RLS policy for deal_activities to include the new fields
DROP POLICY IF EXISTS "Users can view their deal activities" ON deal_activities;
CREATE POLICY "Users can view their deal activities" ON deal_activities FOR SELECT USING (
  deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid()) OR
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "Users can insert deal activities" ON deal_activities;
CREATE POLICY "Users can insert deal activities" ON deal_activities FOR INSERT WITH CHECK (
  user_id = auth.uid() AND 
  (deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid()) OR deal_id IS NULL)
);

DROP POLICY IF EXISTS "Users can update deal activities" ON deal_activities;
CREATE POLICY "Users can update deal activities" ON deal_activities FOR UPDATE USING (
  user_id = auth.uid() AND 
  (deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid()) OR deal_id IS NULL)
);

DROP POLICY IF EXISTS "Users can delete deal activities" ON deal_activities;
CREATE POLICY "Users can delete deal activities" ON deal_activities FOR DELETE USING (
  user_id = auth.uid() AND 
  (deal_id IN (SELECT id FROM deals WHERE owner_id = auth.uid()) OR deal_id IS NULL)
); 