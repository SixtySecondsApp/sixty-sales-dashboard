-- Update stage progression to use SQL as starting point
-- SQL → Opportunity (Proposal) → Negotiation → Signed → Delivered

-- First, ensure deal_stages table exists with proper structure
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  order_position INTEGER NOT NULL,
  default_probability INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update stages with simplified progression (SQL as starting point)
INSERT INTO deal_stages (name, description, color, order_position, default_probability)
VALUES 
  ('SQL', 'Sales Qualified Lead - initial qualified prospect', '#10B981', 1, 25),
  ('Opportunity', 'Proposal sent - formal proposal submitted', '#8B5CF6', 2, 60),
  ('Negotiation', 'Terms being negotiated', '#F59E0B', 3, 75),
  ('Signed', 'Deal closed, contract signed', '#10B981', 4, 100),
  ('Delivered', 'Product/service delivered', '#059669', 5, 100)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  order_position = EXCLUDED.order_position,
  default_probability = EXCLUDED.default_probability,
  updated_at = NOW();

-- Remove deprecated stages (Lead and Meetings Scheduled) if they exist
-- First migrate any deals in these stages to SQL
UPDATE deals 
SET stage_id = (SELECT id FROM deal_stages WHERE name = 'SQL'),
    stage_migration_notes = COALESCE(stage_migration_notes, '') || ' | Migrated from Lead/Meetings to SQL'
WHERE stage_id IN (
  SELECT id FROM deal_stages WHERE name IN ('Lead', 'Meetings Scheduled')
);

-- Now remove the deprecated stages
DELETE FROM deal_stages WHERE name IN ('Lead', 'Meetings Scheduled');

-- Update any existing deals that are in "Opportunity" stage to reflect new meaning
-- Add a comment field to track this migration
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_migration_notes TEXT;

UPDATE deals 
SET stage_migration_notes = 'Pre-migration: Was in Opportunity stage before SQL stage was added'
WHERE stage = 'Opportunity' 
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

-- Add RLS policies for smart task templates (admin only)
ALTER TABLE smart_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smart task templates" ON smart_task_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

CREATE POLICY "All authenticated users can view active templates" ON smart_task_templates
  FOR SELECT USING (
    is_active = true AND auth.uid() IS NOT NULL
  );

-- Insert default smart task templates
INSERT INTO smart_task_templates (trigger_activity_type, task_title, task_description, days_after_trigger, task_type, priority)
VALUES 
  ('proposal', 'Follow up on proposal', 'Check if the client has reviewed the proposal and answer any questions', 3, 'follow_up', 'high'),
  ('meeting', 'Send meeting follow-up', 'Send thank you email and next steps from the meeting', 1, 'follow_up', 'medium'),
  ('outbound', 'Follow up on outreach', 'Check if prospect received initial outreach and gauge interest', 5, 'follow_up', 'medium'),
  ('demo', 'Demo follow-up', 'Send demo recording and schedule next steps discussion', 1, 'follow_up', 'high'),
  ('signed', 'Begin onboarding', 'Initiate client onboarding process and send welcome materials', 0, 'onboarding', 'urgent'),
  ('negotiation', 'Check negotiation progress', 'Follow up on outstanding negotiation points', 2, 'follow_up', 'high')
ON CONFLICT (trigger_activity_type, task_title) DO NOTHING;

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
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_type_deal ON activities(type, deal_id);