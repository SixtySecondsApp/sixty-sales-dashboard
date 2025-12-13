-- ============================================================================
-- Migration: Email Categorization and Gmail Label Mapping
-- ============================================================================
-- Purpose: Create tables and infrastructure for Fyxer-style email categorization:
--   1. email_categorizations: Store AI/rules-derived categories and signals
--   2. gmail_label_mappings: Map Gmail labels to Sixty categories
--   3. Enhance user_sync_status with email history cursor
--   4. Add org-level categorization settings
-- ============================================================================

-- ============================================================================
-- Table 1: email_categorizations
-- Store AI and rules-derived email categories + sales signals
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_categorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Gmail message identification
  external_id TEXT NOT NULL,              -- Gmail message ID
  thread_id TEXT,                         -- Gmail thread ID for grouping
  
  -- Direction and timing
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  received_at TIMESTAMPTZ,
  
  -- Fyxer-style categories
  category TEXT NOT NULL CHECK (category IN (
    'to_respond',     -- Requires user response
    'fyi',            -- Informational, low urgency
    'marketing',      -- Newsletters, promos
    'calendar_related', -- Calendar invites, updates
    'automated',      -- Auto-generated (receipts, notifications)
    'uncategorized'   -- Default/fallback
  )),
  category_confidence NUMERIC CHECK (category_confidence >= 0 AND category_confidence <= 1),
  
  -- Sales signals (JSONB for flexibility)
  signals JSONB DEFAULT '{}'::jsonb,
  -- Example signals structure:
  -- {
  --   "response_required": true,
  --   "urgency": "high",
  --   "keywords": ["proposal", "contract"],
  --   "deal_id": "uuid",
  --   "contact_id": "uuid",
  --   "sentiment": 0.5,
  --   "ghost_risk": false,
  --   "follow_up_due": "2024-01-15",
  --   "action_items": ["Review proposal"]
  -- }
  
  -- Categorization source
  source TEXT NOT NULL CHECK (source IN ('ai', 'rules', 'label_map', 'user_override')),
  
  -- Optional: Link to communication_events if we also stored there
  communication_event_id UUID REFERENCES communication_events(id) ON DELETE SET NULL,
  
  -- Gmail label write-back tracking (for modeC)
  gmail_label_applied BOOLEAN DEFAULT false,
  gmail_label_applied_at TIMESTAMPTZ,
  
  -- Metadata
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique per user+message
  UNIQUE(user_id, external_id)
);

-- Indexes for email_categorizations
CREATE INDEX IF NOT EXISTS idx_email_categorizations_user_category 
  ON email_categorizations(user_id, category);
CREATE INDEX IF NOT EXISTS idx_email_categorizations_user_processed 
  ON email_categorizations(user_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_categorizations_org_category 
  ON email_categorizations(org_id, category) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_categorizations_thread 
  ON email_categorizations(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_categorizations_signals_gin 
  ON email_categorizations USING gin(signals);
-- Index for finding emails needing label writeback
CREATE INDEX IF NOT EXISTS idx_email_categorizations_label_pending
  ON email_categorizations(user_id, category)
  WHERE gmail_label_applied = false;

-- ============================================================================
-- Table 2: gmail_label_mappings
-- Map Gmail labels to Sixty categories (bidirectional sync support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gmail_label_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Sixty category key
  category_key TEXT NOT NULL CHECK (category_key IN (
    'to_respond', 'fyi', 'marketing', 'calendar_related', 'automated'
  )),
  
  -- Gmail label details
  gmail_label_id TEXT NOT NULL,         -- Gmail label ID
  gmail_label_name TEXT NOT NULL,       -- Human-readable name (e.g., "To Respond")
  
  -- Ownership and sync
  is_sixty_managed BOOLEAN DEFAULT false,  -- Did Sixty create this label?
  sync_direction TEXT NOT NULL CHECK (sync_direction IN (
    'gmail_to_sixty',    -- Read Gmail labels, import to Sixty categories
    'sixty_to_gmail',    -- Apply Sixty categories as Gmail labels
    'bidirectional',     -- Sync both ways
    'none'               -- Mapping exists but no active sync
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One mapping per category per user
  UNIQUE(user_id, category_key)
);

-- Indexes for gmail_label_mappings
CREATE INDEX IF NOT EXISTS idx_gmail_label_mappings_user 
  ON gmail_label_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_label_mappings_org 
  ON gmail_label_mappings(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gmail_label_mappings_label_id 
  ON gmail_label_mappings(gmail_label_id);

-- ============================================================================
-- Table 3: org_email_categorization_settings
-- Org-level settings for email categorization (Fyxer modes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS org_email_categorization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  
  -- Master toggle
  is_enabled BOOLEAN DEFAULT true,
  
  -- Label mode (A/B/C from plan)
  -- mode_a_internal_only: Categories stored in Sixty only (DEFAULT)
  -- mode_b_use_existing: Read existing Gmail labels as input signals
  -- mode_c_sync_labels: Write Sixty categories back to Gmail as labels
  label_mode TEXT NOT NULL DEFAULT 'mode_a_internal_only' CHECK (label_mode IN (
    'mode_a_internal_only',
    'mode_b_use_existing',
    'mode_c_sync_labels'
  )),
  
  -- For mode_c: Whether to also archive/move messages
  archive_non_actionable BOOLEAN DEFAULT false,
  
  -- AI categorization settings
  use_ai_categorization BOOLEAN DEFAULT true,
  use_rules_categorization BOOLEAN DEFAULT true,
  
  -- Categories to process (allow selective enablement)
  enabled_categories TEXT[] DEFAULT ARRAY['to_respond', 'fyi', 'marketing']::TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for quick org lookup
CREATE INDEX IF NOT EXISTS idx_org_email_categorization_settings_org 
  ON org_email_categorization_settings(org_id);

-- ============================================================================
-- Enhance user_sync_status with gmail history cursor
-- ============================================================================
ALTER TABLE user_sync_status
  ADD COLUMN IF NOT EXISTS gmail_history_id TEXT,
  ADD COLUMN IF NOT EXISTS gmail_last_full_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_categorization_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_categorization_run_at TIMESTAMPTZ;

-- Comment updates
COMMENT ON COLUMN user_sync_status.gmail_history_id IS 'Gmail historyId for incremental message sync (more efficient than date-based)';
COMMENT ON COLUMN user_sync_status.gmail_last_full_sync_at IS 'Timestamp of last full Gmail sync (to know when to do incremental)';
COMMENT ON COLUMN user_sync_status.email_categorization_enabled IS 'User-level toggle for email categorization';
COMMENT ON COLUMN user_sync_status.last_categorization_run_at IS 'Last time the categorizer processed this user''s emails';

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE email_categorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_label_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_email_categorization_settings ENABLE ROW LEVEL SECURITY;

-- email_categorizations: Users can view their own or org members can view org data
DROP POLICY IF EXISTS "Users view own email categorizations" ON email_categorizations;
CREATE POLICY "Users view own email categorizations" ON email_categorizations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (org_id IS NOT NULL AND org_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    ))
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users manage own email categorizations" ON email_categorizations;
CREATE POLICY "Users manage own email categorizations" ON email_categorizations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- gmail_label_mappings: Users can manage their own
DROP POLICY IF EXISTS "Users manage own gmail label mappings" ON gmail_label_mappings;
CREATE POLICY "Users manage own gmail label mappings" ON gmail_label_mappings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- org_email_categorization_settings: Org admins only
DROP POLICY IF EXISTS "Org admins manage categorization settings" ON org_email_categorization_settings;
CREATE POLICY "Org admins manage categorization settings" ON org_email_categorization_settings
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR auth.role() = 'service_role'
  );

-- Org members can VIEW settings (for client-side logic)
DROP POLICY IF EXISTS "Org members view categorization settings" ON org_email_categorization_settings;
CREATE POLICY "Org members view categorization settings" ON org_email_categorization_settings
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM organization_memberships WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Reuse existing update_updated_at_column function or create if missing
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_categorizations_updated_at ON email_categorizations;
CREATE TRIGGER update_email_categorizations_updated_at
  BEFORE UPDATE ON email_categorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gmail_label_mappings_updated_at ON gmail_label_mappings;
CREATE TRIGGER update_gmail_label_mappings_updated_at
  BEFORE UPDATE ON gmail_label_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_org_email_categorization_settings_updated_at ON org_email_categorization_settings;
CREATE TRIGGER update_org_email_categorization_settings_updated_at
  BEFORE UPDATE ON org_email_categorization_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper function: Get org's label mode
-- ============================================================================
CREATE OR REPLACE FUNCTION get_org_email_label_mode(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_mode TEXT;
BEGIN
  SELECT label_mode INTO v_mode
  FROM org_email_categorization_settings
  WHERE org_id = p_org_id;
  
  -- Default to internal-only if no settings exist
  RETURN COALESCE(v_mode, 'mode_a_internal_only');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Helper function: Insert default org settings when org is created
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_email_categorization_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO org_email_categorization_settings (org_id, is_enabled, label_mode)
  VALUES (NEW.id, true, 'mode_a_internal_only')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on organizations table (if organizations table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'organizations' AND table_schema = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS create_org_email_settings ON organizations;
    CREATE TRIGGER create_org_email_settings
      AFTER INSERT ON organizations
      FOR EACH ROW EXECUTE FUNCTION create_default_email_categorization_settings();
  END IF;
END;
$$;

-- ============================================================================
-- Seed default settings for existing orgs (if any)
-- ============================================================================
INSERT INTO org_email_categorization_settings (org_id, is_enabled, label_mode)
SELECT id, true, 'mode_a_internal_only'
FROM organizations
WHERE id NOT IN (SELECT org_id FROM org_email_categorization_settings)
ON CONFLICT (org_id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE email_categorizations IS 'Fyxer-style email categorizations with AI/rules-derived categories and sales signals';
COMMENT ON TABLE gmail_label_mappings IS 'Maps Gmail labels to Sixty categories for bidirectional sync';
COMMENT ON TABLE org_email_categorization_settings IS 'Org-level settings for email categorization (modes A/B/C)';

COMMENT ON COLUMN email_categorizations.category IS 'Fyxer-style category: to_respond, fyi, marketing, calendar_related, automated, uncategorized';
COMMENT ON COLUMN email_categorizations.signals IS 'JSONB with sales signals: response_required, urgency, deal_id, contact_id, sentiment, ghost_risk, etc.';
COMMENT ON COLUMN email_categorizations.source IS 'How this categorization was determined: ai, rules, label_map, user_override';

COMMENT ON COLUMN gmail_label_mappings.is_sixty_managed IS 'True if Sixty created this label in Gmail (vs user mapping existing label)';
COMMENT ON COLUMN gmail_label_mappings.sync_direction IS 'Direction of sync: gmail_to_sixty, sixty_to_gmail, bidirectional, none';

COMMENT ON COLUMN org_email_categorization_settings.label_mode IS 'Mode A: internal-only (default), Mode B: use existing Gmail labels, Mode C: sync labels to Gmail';

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'email_categorizations',
      'gmail_label_mappings',
      'org_email_categorization_settings'
    );

  RAISE NOTICE 'Email categorization tables created: %/3', table_count;
  RAISE NOTICE 'Email categorization migration completed ✓';
END;
$$;

