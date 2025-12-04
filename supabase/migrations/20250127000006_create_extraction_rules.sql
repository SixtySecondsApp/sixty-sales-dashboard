-- Phase 6: Extraction Customization
-- Creates tables for custom task extraction rules and meeting type templates

-- Task Extraction Rules Table
CREATE TABLE IF NOT EXISTS task_extraction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_phrases TEXT[] NOT NULL,
  task_category TEXT NOT NULL,
  default_priority TEXT DEFAULT 'medium' CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  default_deadline_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Type Templates Table
CREATE TABLE IF NOT EXISTS meeting_type_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL CHECK (
    meeting_type IN ('discovery', 'demo', 'negotiation', 'closing', 'follow_up', 'general')
  ),
  extraction_template JSONB DEFAULT '{}'::jsonb,
  content_templates JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, meeting_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_extraction_rules_user_id ON task_extraction_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_task_extraction_rules_active ON task_extraction_rules(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_meeting_type_templates_user_id ON meeting_type_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_type_templates_active ON meeting_type_templates(user_id, is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE task_extraction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_type_templates ENABLE ROW LEVEL SECURITY;

-- Users can only access their own extraction rules
CREATE POLICY "Users can view their own extraction rules"
  ON task_extraction_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extraction rules"
  ON task_extraction_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extraction rules"
  ON task_extraction_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extraction rules"
  ON task_extraction_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Users can only access their own meeting type templates
CREATE POLICY "Users can view their own meeting type templates"
  ON meeting_type_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meeting type templates"
  ON meeting_type_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting type templates"
  ON meeting_type_templates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting type templates"
  ON meeting_type_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_extraction_rules_updated_at
  BEFORE UPDATE ON task_extraction_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_type_templates_updated_at
  BEFORE UPDATE ON meeting_type_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE task_extraction_rules IS 'Custom rules for extracting tasks from meeting transcripts based on trigger phrases';
COMMENT ON TABLE meeting_type_templates IS 'Templates for extraction and content generation based on meeting type';












