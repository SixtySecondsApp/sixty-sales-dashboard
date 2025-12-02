-- =====================================================
-- Multi-Tenant: Add org_id to Missing Tables
-- =====================================================
-- Tables created after January 2025 need org_id column
-- for organization-based data isolation.
--
-- This migration adds org_id column with FK to organizations
-- Initially nullable for safe backfill, will be made NOT NULL later

-- =====================================================
-- Relationship Health System Tables
-- =====================================================

-- relationship_health_scores
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_health_scores' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE relationship_health_scores
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_relationship_health_scores_org_id
      ON relationship_health_scores(org_id);
  END IF;
END $$;

-- ghost_detection_signals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ghost_detection_signals' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE ghost_detection_signals
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_ghost_detection_signals_org_id
      ON ghost_detection_signals(org_id);
  END IF;
END $$;

-- intervention_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intervention_templates' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE intervention_templates
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_intervention_templates_org_id
      ON intervention_templates(org_id);
  END IF;
END $$;

-- interventions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interventions' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE interventions
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_interventions_org_id
      ON interventions(org_id);
  END IF;
END $$;

-- communication_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_events' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE communication_events
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_communication_events_org_id
      ON communication_events(org_id);
  END IF;
END $$;

-- relationship_health_history
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_health_history' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE relationship_health_history
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_relationship_health_history_org_id
      ON relationship_health_history(org_id);
  END IF;
END $$;

-- =====================================================
-- Proposal & Template Tables
-- =====================================================

-- proposal_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_jobs' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE proposal_jobs
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_proposal_jobs_org_id
      ON proposal_jobs(org_id);
  END IF;
END $$;

-- scheduled_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_emails' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE scheduled_emails
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_scheduled_emails_org_id
      ON scheduled_emails(org_id);
  END IF;
END $$;

-- sales_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_templates' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE sales_templates
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_sales_templates_org_id
      ON sales_templates(org_id);
  END IF;
END $$;

-- =====================================================
-- User Settings Tables (tenant-scoped)
-- =====================================================

-- user_writing_styles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_writing_styles' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE user_writing_styles
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_user_writing_styles_org_id
      ON user_writing_styles(org_id);
  END IF;
END $$;

-- user_onboarding_progress
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_onboarding_progress' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE user_onboarding_progress
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_org_id
      ON user_onboarding_progress(org_id);
  END IF;
END $$;

-- user_ai_feature_settings (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ai_feature_settings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_ai_feature_settings' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE user_ai_feature_settings
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_user_ai_feature_settings_org_id
        ON user_ai_feature_settings(org_id);
    END IF;
  END IF;
END $$;

-- user_tone_settings (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tone_settings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_tone_settings' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE user_tone_settings
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_user_tone_settings_org_id
        ON user_tone_settings(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Meeting Intelligence Tables
-- =====================================================

-- sentiment_alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sentiment_alerts' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE sentiment_alerts
      ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_sentiment_alerts_org_id
      ON sentiment_alerts(org_id);
  END IF;
END $$;

-- meeting_intelligence_queries (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_intelligence_queries') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_intelligence_queries' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE meeting_intelligence_queries
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_meeting_intelligence_queries_org_id
        ON meeting_intelligence_queries(org_id);
    END IF;
  END IF;
END $$;

-- global_topics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_topics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'global_topics' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE global_topics
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_global_topics_org_id
        ON global_topics(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Mapping & Config Tables
-- =====================================================

-- csv_mapping_templates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_mapping_templates') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'csv_mapping_templates' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE csv_mapping_templates
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_csv_mapping_templates_org_id
        ON csv_mapping_templates(org_id);
    END IF;
  END IF;
END $$;

-- savvycal_link_mappings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'savvycal_link_mappings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'savvycal_link_mappings' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE savvycal_link_mappings
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_savvycal_link_mappings_org_id
        ON savvycal_link_mappings(org_id);
    END IF;
  END IF;
END $$;

-- user_sync_status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sync_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_sync_status' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE user_sync_status
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_user_sync_status_org_id
        ON user_sync_status(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Copilot Tables
-- =====================================================

-- copilot_conversations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'copilot_conversations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'copilot_conversations' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE copilot_conversations
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_copilot_conversations_org_id
        ON copilot_conversations(org_id);
    END IF;
  END IF;
END $$;

-- copilot_analytics
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'copilot_analytics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'copilot_analytics' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE copilot_analytics
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_copilot_analytics_org_id
        ON copilot_analytics(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Integration Tables
-- =====================================================

-- booking_sources
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_sources') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'booking_sources' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE booking_sources
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_booking_sources_org_id
        ON booking_sources(org_id);
    END IF;
  END IF;
END $$;

-- slack_integrations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_integrations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'slack_integrations' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE slack_integrations
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_slack_integrations_org_id
        ON slack_integrations(org_id);
    END IF;
  END IF;
END $$;

-- fathom_integrations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fathom_integrations') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'fathom_integrations' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE fathom_integrations
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_fathom_integrations_org_id
        ON fathom_integrations(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Junction/Relationship Tables (if they don't have org_id)
-- =====================================================

-- company_activities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_activities') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'company_activities' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE company_activities
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_company_activities_org_id
        ON company_activities(org_id);
    END IF;
  END IF;
END $$;

-- deal_meetings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_meetings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deal_meetings' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE deal_meetings
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_deal_meetings_org_id
        ON deal_meetings(org_id);
    END IF;
  END IF;
END $$;

-- deal_stakeholders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stakeholders') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deal_stakeholders' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE deal_stakeholders
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_deal_stakeholders_org_id
        ON deal_stakeholders(org_id);
    END IF;
  END IF;
END $$;

-- contact_interactions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_interactions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'contact_interactions' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE contact_interactions
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_contact_interactions_org_id
        ON contact_interactions(org_id);
    END IF;
  END IF;
END $$;

-- activity_meetings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_meetings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'activity_meetings' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE activity_meetings
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_activity_meetings_org_id
        ON activity_meetings(org_id);
    END IF;
  END IF;
END $$;

-- meeting_sequences
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_sequences') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_sequences' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE meeting_sequences
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_meeting_sequences_org_id
        ON meeting_sequences(org_id);
    END IF;
  END IF;
END $$;

-- deal_activities
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_activities') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deal_activities' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE deal_activities
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_deal_activities_org_id
        ON deal_activities(org_id);
    END IF;
  END IF;
END $$;

-- deal_stage_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stage_history') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'deal_stage_history' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE deal_stage_history
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_deal_stage_history_org_id
        ON deal_stage_history(org_id);
    END IF;
  END IF;
END $$;

-- next_action_suggestions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'next_action_suggestions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'next_action_suggestions' AND column_name = 'org_id'
    ) THEN
      ALTER TABLE next_action_suggestions
        ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_next_action_suggestions_org_id
        ON next_action_suggestions(org_id);
    END IF;
  END IF;
END $$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON COLUMN relationship_health_scores.org_id IS 'Organization (tenant) that owns this health score';
COMMENT ON COLUMN communication_events.org_id IS 'Organization (tenant) that owns this communication event';
COMMENT ON COLUMN proposal_jobs.org_id IS 'Organization (tenant) that owns this proposal job';
COMMENT ON COLUMN sales_templates.org_id IS 'Organization (tenant) that owns this template';
