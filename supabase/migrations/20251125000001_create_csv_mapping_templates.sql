-- Create CSV mapping templates table for storing reusable field mappings
-- This allows users to save and reuse column mappings for CSV imports

CREATE TABLE IF NOT EXISTS csv_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  column_mappings JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Example: {"Email": "contact_email", "First Name": "contact_first_name"}
  source_hint TEXT,
  -- e.g., "My HubSpot Export", "LinkedIn CSV", "Custom CRM"
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_csv_mapping_templates_user_id ON csv_mapping_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_csv_mapping_templates_last_used ON csv_mapping_templates(last_used_at DESC NULLS LAST);

-- Add updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_csv_mapping_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_csv_mapping_templates_updated_at
      BEFORE UPDATE ON csv_mapping_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE csv_mapping_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only manage their own templates
DO $$
BEGIN
  -- Drop existing policies if they exist (for idempotency)
  DROP POLICY IF EXISTS "Users can view their own templates" ON csv_mapping_templates;
  DROP POLICY IF EXISTS "Users can create their own templates" ON csv_mapping_templates;
  DROP POLICY IF EXISTS "Users can update their own templates" ON csv_mapping_templates;
  DROP POLICY IF EXISTS "Users can delete their own templates" ON csv_mapping_templates;

  -- Create policies
  CREATE POLICY "Users can view their own templates"
    ON csv_mapping_templates FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

  CREATE POLICY "Users can create their own templates"
    ON csv_mapping_templates FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY "Users can update their own templates"
    ON csv_mapping_templates FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY "Users can delete their own templates"
    ON csv_mapping_templates FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
END $$;

-- Add comments
COMMENT ON TABLE csv_mapping_templates IS 'Stores reusable CSV column-to-lead-field mappings for the generic CSV import feature';
COMMENT ON COLUMN csv_mapping_templates.column_mappings IS 'JSONB mapping of CSV column names to lead table field names';
COMMENT ON COLUMN csv_mapping_templates.source_hint IS 'Human-readable hint about what CSV source this template is for (e.g., "HubSpot Export")';
COMMENT ON COLUMN csv_mapping_templates.usage_count IS 'Number of times this template has been used';
COMMENT ON COLUMN csv_mapping_templates.last_used_at IS 'Timestamp of when this template was last used for an import';
