-- Update stage progression to use SQL as starting point
-- SQL → Opportunity (Proposal) → Verbal → Signed
-- Removes deprecated stages: Lead, Meetings Scheduled, Negotiation, Delivered, Signed & Paid

-- First, ensure deal_stages table exists with proper structure
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  order_position INTEGER NOT NULL,
  default_probability INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on name if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deal_stages_name_key' 
    AND conrelid = 'deal_stages'::regclass
  ) THEN
    ALTER TABLE deal_stages ADD CONSTRAINT deal_stages_name_key UNIQUE (name);
  END IF;
END $$;

-- Update stages with simplified progression (SQL as starting point)
-- SQL → Opportunity → Verbal → Signed
DO $$
BEGIN
  -- Update or insert SQL stage
  IF EXISTS (SELECT 1 FROM deal_stages WHERE name = 'SQL') THEN
    UPDATE deal_stages SET 
      description = 'Sales Qualified Lead - initial qualified prospect',
      color = '#10B981',
      order_position = 1,
      default_probability = 25,
      updated_at = NOW()
    WHERE name = 'SQL';
  ELSE
    INSERT INTO deal_stages (name, description, color, order_position, default_probability)
    VALUES ('SQL', 'Sales Qualified Lead - initial qualified prospect', '#10B981', 1, 25);
  END IF;

  -- Update or insert Opportunity stage
  IF EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Opportunity') THEN
    UPDATE deal_stages SET 
      description = 'Proposal sent - formal proposal submitted',
      color = '#8B5CF6',
      order_position = 2,
      default_probability = 60,
      updated_at = NOW()
    WHERE name = 'Opportunity';
  ELSE
    INSERT INTO deal_stages (name, description, color, order_position, default_probability)
    VALUES ('Opportunity', 'Proposal sent - formal proposal submitted', '#8B5CF6', 2, 60);
  END IF;

  -- Update or insert Verbal stage (moved before Signed)
  IF EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Verbal') THEN
    UPDATE deal_stages SET 
      description = 'Verbal agreement reached',
      color = '#F59E0B',
      order_position = 3,
      default_probability = 80,
      updated_at = NOW()
    WHERE name = 'Verbal';
  ELSE
    INSERT INTO deal_stages (name, description, color, order_position, default_probability)
    VALUES ('Verbal', 'Verbal agreement reached', '#F59E0B', 3, 80);
  END IF;

  -- Update or insert Signed stage
  IF EXISTS (SELECT 1 FROM deal_stages WHERE name = 'Signed') THEN
    UPDATE deal_stages SET 
      description = 'Deal closed, contract signed',
      color = '#10B981',
      order_position = 4,
      default_probability = 100,
      updated_at = NOW()
    WHERE name = 'Signed';
  ELSE
    INSERT INTO deal_stages (name, description, color, order_position, default_probability)
    VALUES ('Signed', 'Deal closed, contract signed', '#10B981', 4, 100);
  END IF;

  -- Migrate deals from deprecated stages
  -- First migrate any deals in Negotiation to Verbal
  UPDATE deals 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Verbal'),
      stage_migration_notes = COALESCE(stage_migration_notes, '') || ' | Migrated from Negotiation to Verbal'
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Negotiation');
  
  -- Migrate deals from Delivered to Signed
  UPDATE deals 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed'),
      stage_migration_notes = COALESCE(stage_migration_notes, '') || ' | Migrated from Delivered to Signed'
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Delivered');
  
  -- Migrate deals from "Signed & Paid" to Signed
  UPDATE deals 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed'),
      stage_migration_notes = COALESCE(stage_migration_notes, '') || ' | Migrated from Signed & Paid to Signed'
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed & Paid');
  
  -- Update deal_stage_history to point to new stages before deleting old ones
  -- Migrate Negotiation history to Verbal
  UPDATE deal_stage_history 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Verbal')
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Negotiation');
  
  -- Migrate Delivered history to Signed
  UPDATE deal_stage_history 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed')
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Delivered');
  
  -- Migrate "Signed & Paid" history to Signed
  UPDATE deal_stage_history 
  SET stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed')
  WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Signed & Paid');
  
  -- Now delete the deprecated stages (safe after updating references)
  DELETE FROM deal_stages WHERE name IN ('Negotiation', 'Delivered', 'Signed & Paid');
END $$;

-- Add a comment field to track this migration (if it doesn't exist)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_migration_notes TEXT;

-- Remove deprecated stages (Lead and Meetings Scheduled) if they exist
-- First migrate any deals in these stages to SQL
UPDATE deals 
SET stage_id = (SELECT id FROM deal_stages WHERE name = 'SQL'),
    stage_migration_notes = COALESCE(stage_migration_notes, '') || ' | Migrated from Lead/Meetings to SQL'
WHERE stage_id IN (
  SELECT id FROM deal_stages WHERE name IN ('Lead', 'Meetings Scheduled')
);

-- Update deal_stage_history for Lead and Meetings Scheduled stages
UPDATE deal_stage_history 
SET stage_id = (SELECT id FROM deal_stages WHERE name = 'SQL')
WHERE stage_id IN (
  SELECT id FROM deal_stages WHERE name IN ('Lead', 'Meetings Scheduled')
);

-- Now remove all the deprecated stages (safe after updating all references)
DELETE FROM deal_stages WHERE name IN ('Lead', 'Meetings Scheduled', 'Negotiation', 'Delivered', 'Signed & Paid');

UPDATE deals 
SET stage_migration_notes = 'Pre-migration: Was in Opportunity stage before SQL stage was added'
WHERE stage_id = (SELECT id FROM deal_stages WHERE name = 'Opportunity')
  AND stage_migration_notes IS NULL;

-- Create smart task templates table for automated follow-ups
CREATE TABLE IF NOT EXISTS smart_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_activity_type TEXT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT,
  days_after_trigger INTEGER NOT NULL DEFAULT 3,
  task_type TEXT NOT NULL DEFAULT 'follow_up',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trigger_activity_type, task_title)
);

-- Add RLS policies for smart task templates
ALTER TABLE smart_task_templates ENABLE ROW LEVEL SECURITY;

-- Check if user_profiles table exists before creating admin policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    -- Create admin policy if user_profiles exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'smart_task_templates' 
      AND policyname = 'Admins can manage smart task templates'
    ) THEN
      CREATE POLICY "Admins can manage smart task templates" ON smart_task_templates
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
          )
        );
    END IF;
  ELSE
    -- Fallback: Allow all authenticated users to manage templates if user_profiles doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'smart_task_templates' 
      AND policyname = 'Authenticated users can manage smart task templates'
    ) THEN
      CREATE POLICY "Authenticated users can manage smart task templates" ON smart_task_templates
        FOR ALL USING (auth.uid() IS NOT NULL);
    END IF;
  END IF;
END $$;

-- Create view policy for all authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'smart_task_templates' 
    AND policyname = 'All authenticated users can view active templates'
  ) THEN
    CREATE POLICY "All authenticated users can view active templates" ON smart_task_templates
      FOR SELECT USING (
        is_active = true AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- Insert default smart task templates
INSERT INTO smart_task_templates (trigger_activity_type, task_title, task_description, days_after_trigger, task_type, priority)
VALUES 
  ('proposal', 'Follow up on proposal', 'Check if the client has reviewed the proposal and answer any questions', 3, 'follow_up', 'high'),
  ('meeting', 'Send meeting follow-up', 'Send thank you email and next steps from the meeting', 1, 'follow_up', 'medium'),
  ('outbound', 'Follow up on outreach', 'Check if prospect received initial outreach and gauge interest', 5, 'follow_up', 'medium'),
  ('demo', 'Demo follow-up', 'Send demo recording and schedule next steps discussion', 1, 'follow_up', 'high'),
  ('signed', 'Begin onboarding', 'Initiate client onboarding process and send welcome materials', 0, 'onboarding', 'urgent')
ON CONFLICT (trigger_activity_type, task_title) DO NOTHING;

-- Remove negotiation smart task template if it exists
DELETE FROM smart_task_templates WHERE trigger_activity_type = 'negotiation';

-- Create function to auto-generate tasks from templates
CREATE OR REPLACE FUNCTION create_smart_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if the activity has a deal_id
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create tasks based on active templates
  INSERT INTO tasks (
    title,
    description,
    due_date,
    task_type,
    priority,
    owner_id,
    deal_id,
    created_by,
    status
  )
  SELECT 
    stt.task_title,
    COALESCE(stt.task_description, '') || 
      E'\\n\\nAuto-generated from ' || NEW.type || ' activity on ' || TO_CHAR(NEW.created_at, 'YYYY-MM-DD'),
    NEW.created_at::DATE + stt.days_after_trigger,
    stt.task_type,
    stt.priority,
    NEW.owner_id,
    NEW.deal_id,
    NEW.owner_id,
    'pending'
  FROM smart_task_templates stt
  WHERE stt.trigger_activity_type = NEW.type
    AND stt.is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activities table
DROP TRIGGER IF EXISTS trigger_create_smart_tasks ON activities;
CREATE TRIGGER trigger_create_smart_tasks
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION create_smart_tasks();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_smart_task_templates_trigger ON smart_task_templates(trigger_activity_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_activities_type_deal ON activities(type, deal_id);