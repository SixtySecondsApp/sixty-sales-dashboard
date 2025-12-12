-- Migration: Organization Call Types
-- Purpose: Enable org-level configurable call types with AI classification
-- Date: 2025-12-13

-- =============================================================================
-- Table: org_call_types
-- Purpose: Organization-level call type definitions for meeting classification
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_call_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Keywords for AI context and matching
  keywords TEXT[] DEFAULT '{}',
  
  -- UI display properties
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'phone',
  
  -- System defaults vs custom types
  is_system BOOLEAN DEFAULT false,
  
  -- Active status and ordering
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique call type names per org
  UNIQUE(org_id, name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_call_types_org_id ON org_call_types(org_id);
CREATE INDEX IF NOT EXISTS idx_org_call_types_active ON org_call_types(org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_call_types_display_order ON org_call_types(org_id, display_order);

-- Add call_type_id and call_type_reasoning to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS call_type_id UUID REFERENCES org_call_types(id) ON DELETE SET NULL;

ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS call_type_reasoning TEXT;

ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS call_type_confidence NUMERIC(3,2) CHECK (
  call_type_confidence >= 0 AND call_type_confidence <= 1
);

-- Add index for call type queries
CREATE INDEX IF NOT EXISTS idx_meetings_call_type_id ON meetings(call_type_id) WHERE call_type_id IS NOT NULL;

-- Enable RLS
ALTER TABLE org_call_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view call types for their org
CREATE POLICY "Users can view their org's call types"
  ON org_call_types FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

-- RLS Policies: Org admins/owners can manage call types
CREATE POLICY "Org admins can insert call types"
  ON org_call_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update call types"
  ON org_call_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete call types"
  ON org_call_types FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = org_call_types.org_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role IN ('owner', 'admin')
    )
    -- Prevent deletion of system types
    AND is_system = false
  );

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_org_call_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_org_call_types_updated_at
  BEFORE UPDATE ON org_call_types
  FOR EACH ROW
  EXECUTE FUNCTION update_org_call_types_updated_at();

-- Function to seed default call types for an organization
CREATE OR REPLACE FUNCTION seed_default_call_types(p_org_id UUID)
RETURNS void AS $$
BEGIN
  -- Only seed if org doesn't have any call types yet
  IF NOT EXISTS (SELECT 1 FROM org_call_types WHERE org_id = p_org_id) THEN
    INSERT INTO org_call_types (org_id, name, description, keywords, color, icon, is_system, display_order) VALUES
      (p_org_id, 'Discovery', 'Initial qualification and needs assessment', 
       ARRAY['pain points', 'challenges', 'current process', 'goals', 'objectives', 'what are you', 'tell me about', 'how do you', 'what challenges', 'what problems', 'current situation', 'understanding', 'learn more', 'background'], 
       '#8b5cf6', 'search', true, 1),
      (p_org_id, 'Demo', 'Product demonstration', 
       ARRAY['show you', 'demonstration', 'walkthrough', 'feature', 'demo', 'showcase', 'preview', 'see how', 'let me show', 'here is how', 'this is how', 'example', 'illustrate'], 
       '#3b82f6', 'presentation', true, 2),
      (p_org_id, 'Close', 'Contract finalization', 
       ARRAY['sign', 'agreement', 'start date', 'onboarding', 'next steps', 'move forward', 'ready to', 'commit', 'decision', 'approve', 'finalize', 'execute', 'contract', 'paperwork'], 
       '#10b981', 'check-circle', true, 3),
      (p_org_id, 'Client', 'Existing client communication', 
       ARRAY['check in', 'status update', 'support', 'client', 'customer', 'account', 'relationship'], 
       '#6366f1', 'users', true, 4),
      (p_org_id, 'Internal Stand Up', 'Internal team meeting', 
       ARRAY['standup', 'team sync', 'blockers', 'daily', 'status', 'update', 'internal'], 
       '#f59e0b', 'users-2', true, 5),
      (p_org_id, 'Scrum', 'Agile ceremony', 
       ARRAY['sprint', 'backlog', 'retro', 'scrum', 'agile', 'sprint planning', 'sprint review', 'retrospective'], 
       '#ef4444', 'calendar', true, 6)
    ON CONFLICT (org_id, name) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE org_call_types IS 'Organization-level call type definitions for AI-powered meeting classification';
COMMENT ON COLUMN org_call_types.keywords IS 'Keywords used by AI to identify this call type in transcripts';
COMMENT ON COLUMN org_call_types.is_system IS 'System default types cannot be deleted, only deactivated';
COMMENT ON COLUMN meetings.call_type_id IS 'AI-classified call type from org_call_types';
COMMENT ON COLUMN meetings.call_type_reasoning IS 'AI explanation for why this call type was selected';
COMMENT ON COLUMN meetings.call_type_confidence IS 'Confidence score (0-1) for the call type classification';

