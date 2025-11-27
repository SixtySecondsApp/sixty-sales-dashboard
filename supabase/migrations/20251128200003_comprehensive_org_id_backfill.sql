-- =====================================================
-- Multi-Tenant: Comprehensive org_id Backfill
-- =====================================================
-- This migration backfills org_id for all tables created after January 2025
-- that were not covered by the original backfill migration.
--
-- IMPORTANT: This runs AFTER:
-- 1. 20251128200001_add_org_id_to_missing_tables.sql
-- 2. 20251128200002_ensure_org_memberships.sql

DO $$
DECLARE
  default_org_id UUID;
  rows_updated INTEGER;
BEGIN
  -- Get default organization ID
  SELECT id INTO default_org_id
  FROM organizations
  WHERE name = 'Default Organization'
  LIMIT 1;

  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default Organization not found. Run ensure_org_memberships migration first.';
  END IF;

  RAISE NOTICE 'Starting comprehensive org_id backfill with default_org_id: %', default_org_id;

  -- =====================================================
  -- Relationship Health System Tables
  -- =====================================================

  -- relationship_health_scores: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationship_health_scores') THEN
    UPDATE relationship_health_scores rhs
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = rhs.user_id LIMIT 1),
      default_org_id
    )
    WHERE rhs.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'relationship_health_scores: % rows updated', rows_updated;
  END IF;

  -- ghost_detection_signals: inherit from relationship_health_scores OR use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ghost_detection_signals') THEN
    UPDATE ghost_detection_signals gds
    SET org_id = COALESCE(
      (SELECT rhs.org_id FROM relationship_health_scores rhs WHERE rhs.id = gds.relationship_health_id),
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = gds.user_id LIMIT 1),
      default_org_id
    )
    WHERE gds.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'ghost_detection_signals: % rows updated', rows_updated;
  END IF;

  -- intervention_templates: use created_by or user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'intervention_templates') THEN
    UPDATE intervention_templates it
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = it.created_by LIMIT 1),
      default_org_id
    )
    WHERE it.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'intervention_templates: % rows updated', rows_updated;
  END IF;

  -- interventions: inherit from relationship_health_scores OR use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interventions') THEN
    UPDATE interventions i
    SET org_id = COALESCE(
      (SELECT rhs.org_id FROM relationship_health_scores rhs WHERE rhs.id = i.relationship_health_id),
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = i.executed_by LIMIT 1),
      default_org_id
    )
    WHERE i.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'interventions: % rows updated', rows_updated;
  END IF;

  -- communication_events: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_events') THEN
    UPDATE communication_events ce
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = ce.user_id LIMIT 1),
      default_org_id
    )
    WHERE ce.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'communication_events: % rows updated', rows_updated;
  END IF;

  -- relationship_health_history: inherit from relationship_health_scores
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationship_health_history') THEN
    UPDATE relationship_health_history rhh
    SET org_id = COALESCE(
      (SELECT rhs.org_id FROM relationship_health_scores rhs WHERE rhs.id = rhh.relationship_health_id),
      default_org_id
    )
    WHERE rhh.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'relationship_health_history: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Proposal & Template Tables
  -- =====================================================

  -- proposal_jobs: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_jobs') THEN
    UPDATE proposal_jobs pj
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = pj.user_id LIMIT 1),
      default_org_id
    )
    WHERE pj.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'proposal_jobs: % rows updated', rows_updated;
  END IF;

  -- scheduled_emails: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_emails') THEN
    UPDATE scheduled_emails se
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = se.user_id LIMIT 1),
      default_org_id
    )
    WHERE se.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'scheduled_emails: % rows updated', rows_updated;
  END IF;

  -- sales_templates: use user_id or created_by
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_templates') THEN
    UPDATE sales_templates st
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = st.user_id LIMIT 1),
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = st.created_by LIMIT 1),
      default_org_id
    )
    WHERE st.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'sales_templates: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- User Settings Tables
  -- =====================================================

  -- user_writing_styles: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_writing_styles') THEN
    UPDATE user_writing_styles uws
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = uws.user_id LIMIT 1),
      default_org_id
    )
    WHERE uws.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'user_writing_styles: % rows updated', rows_updated;
  END IF;

  -- user_onboarding_progress: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_onboarding_progress') THEN
    UPDATE user_onboarding_progress uop
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = uop.user_id LIMIT 1),
      default_org_id
    )
    WHERE uop.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'user_onboarding_progress: % rows updated', rows_updated;
  END IF;

  -- user_ai_feature_settings: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ai_feature_settings') THEN
    UPDATE user_ai_feature_settings uafs
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = uafs.user_id LIMIT 1),
      default_org_id
    )
    WHERE uafs.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'user_ai_feature_settings: % rows updated', rows_updated;
  END IF;

  -- user_tone_settings: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_tone_settings') THEN
    UPDATE user_tone_settings uts
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = uts.user_id LIMIT 1),
      default_org_id
    )
    WHERE uts.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'user_tone_settings: % rows updated', rows_updated;
  END IF;

  -- user_sync_status: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sync_status') THEN
    UPDATE user_sync_status uss
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = uss.user_id LIMIT 1),
      default_org_id
    )
    WHERE uss.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'user_sync_status: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Meeting Intelligence Tables
  -- =====================================================

  -- sentiment_alerts: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentiment_alerts') THEN
    UPDATE sentiment_alerts sa
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = sa.user_id LIMIT 1),
      default_org_id
    )
    WHERE sa.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'sentiment_alerts: % rows updated', rows_updated;
  END IF;

  -- meeting_intelligence_queries: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_intelligence_queries') THEN
    UPDATE meeting_intelligence_queries miq
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = miq.user_id LIMIT 1),
      default_org_id
    )
    WHERE miq.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'meeting_intelligence_queries: % rows updated', rows_updated;
  END IF;

  -- global_topics: use user_id or created_by
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_topics') THEN
    -- First try user_id, then created_by
    UPDATE global_topics gt
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = gt.user_id LIMIT 1),
      default_org_id
    )
    WHERE gt.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'global_topics: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Mapping & Config Tables
  -- =====================================================

  -- csv_mapping_templates: use user_id or created_by
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'csv_mapping_templates') THEN
    UPDATE csv_mapping_templates cmt
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = cmt.user_id LIMIT 1),
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = cmt.created_by LIMIT 1),
      default_org_id
    )
    WHERE cmt.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'csv_mapping_templates: % rows updated', rows_updated;
  END IF;

  -- savvycal_link_mappings: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'savvycal_link_mappings') THEN
    UPDATE savvycal_link_mappings slm
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = slm.user_id LIMIT 1),
      default_org_id
    )
    WHERE slm.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'savvycal_link_mappings: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Copilot Tables
  -- =====================================================

  -- copilot_conversations: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'copilot_conversations') THEN
    UPDATE copilot_conversations cc
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = cc.user_id LIMIT 1),
      default_org_id
    )
    WHERE cc.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'copilot_conversations: % rows updated', rows_updated;
  END IF;

  -- copilot_analytics: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'copilot_analytics') THEN
    UPDATE copilot_analytics ca
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = ca.user_id LIMIT 1),
      default_org_id
    )
    WHERE ca.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'copilot_analytics: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Integration Tables
  -- =====================================================

  -- booking_sources: use user_id or created_by
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_sources') THEN
    UPDATE booking_sources bs
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = bs.user_id LIMIT 1),
      default_org_id
    )
    WHERE bs.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'booking_sources: % rows updated', rows_updated;
  END IF;

  -- slack_integrations: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'slack_integrations') THEN
    UPDATE slack_integrations si
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = si.user_id LIMIT 1),
      default_org_id
    )
    WHERE si.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'slack_integrations: % rows updated', rows_updated;
  END IF;

  -- fathom_integrations: use user_id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fathom_integrations') THEN
    UPDATE fathom_integrations fi
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = fi.user_id LIMIT 1),
      default_org_id
    )
    WHERE fi.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'fathom_integrations: % rows updated', rows_updated;
  END IF;

  -- =====================================================
  -- Junction/Relationship Tables
  -- These inherit org_id from their parent entities
  -- =====================================================

  -- company_activities: inherit from company
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_activities') THEN
    UPDATE company_activities ca
    SET org_id = COALESCE(
      (SELECT c.org_id FROM companies c WHERE c.id = ca.company_id),
      (SELECT a.org_id FROM activities a WHERE a.id = ca.activity_id),
      default_org_id
    )
    WHERE ca.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'company_activities: % rows updated', rows_updated;
  END IF;

  -- deal_meetings: inherit from deal
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_meetings') THEN
    UPDATE deal_meetings dm
    SET org_id = COALESCE(
      (SELECT d.org_id FROM deals d WHERE d.id = dm.deal_id),
      (SELECT m.org_id FROM meetings m WHERE m.id = dm.meeting_id),
      default_org_id
    )
    WHERE dm.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'deal_meetings: % rows updated', rows_updated;
  END IF;

  -- deal_stakeholders: inherit from deal
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stakeholders') THEN
    UPDATE deal_stakeholders ds
    SET org_id = COALESCE(
      (SELECT d.org_id FROM deals d WHERE d.id = ds.deal_id),
      (SELECT c.org_id FROM contacts c WHERE c.id = ds.contact_id),
      default_org_id
    )
    WHERE ds.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'deal_stakeholders: % rows updated', rows_updated;
  END IF;

  -- contact_interactions: inherit from contact
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_interactions') THEN
    UPDATE contact_interactions ci
    SET org_id = COALESCE(
      (SELECT c.org_id FROM contacts c WHERE c.id = ci.contact_id),
      default_org_id
    )
    WHERE ci.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'contact_interactions: % rows updated', rows_updated;
  END IF;

  -- activity_meetings: inherit from activity or meeting
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_meetings') THEN
    UPDATE activity_meetings am
    SET org_id = COALESCE(
      (SELECT a.org_id FROM activities a WHERE a.id = am.activity_id),
      (SELECT m.org_id FROM meetings m WHERE m.id = am.meeting_id),
      default_org_id
    )
    WHERE am.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'activity_meetings: % rows updated', rows_updated;
  END IF;

  -- meeting_sequences: inherit from meeting
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_sequences') THEN
    UPDATE meeting_sequences ms
    SET org_id = COALESCE(
      (SELECT m.org_id FROM meetings m WHERE m.id = ms.meeting_id),
      default_org_id
    )
    WHERE ms.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'meeting_sequences: % rows updated', rows_updated;
  END IF;

  -- deal_activities: inherit from deal
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_activities') THEN
    UPDATE deal_activities da
    SET org_id = COALESCE(
      (SELECT d.org_id FROM deals d WHERE d.id = da.deal_id),
      (SELECT a.org_id FROM activities a WHERE a.id = da.activity_id),
      default_org_id
    )
    WHERE da.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'deal_activities: % rows updated', rows_updated;
  END IF;

  -- deal_stage_history: inherit from deal
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stage_history') THEN
    UPDATE deal_stage_history dsh
    SET org_id = COALESCE(
      (SELECT d.org_id FROM deals d WHERE d.id = dsh.deal_id),
      default_org_id
    )
    WHERE dsh.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'deal_stage_history: % rows updated', rows_updated;
  END IF;

  -- next_action_suggestions: use user_id or inherit from deal/contact
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'next_action_suggestions') THEN
    UPDATE next_action_suggestions nas
    SET org_id = COALESCE(
      (SELECT om.org_id FROM organization_memberships om WHERE om.user_id = nas.user_id LIMIT 1),
      (SELECT d.org_id FROM deals d WHERE d.id = nas.deal_id),
      (SELECT c.org_id FROM contacts c WHERE c.id = nas.contact_id),
      default_org_id
    )
    WHERE nas.org_id IS NULL;
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'next_action_suggestions: % rows updated', rows_updated;
  END IF;

  RAISE NOTICE 'Comprehensive org_id backfill complete';

END $$;

-- =====================================================
-- Verification Queries
-- =====================================================
-- Run these after migration to verify no NULL org_id values remain:
--
-- SELECT
--   'relationship_health_scores' as table_name,
--   COUNT(*) FILTER (WHERE org_id IS NULL) as null_count,
--   COUNT(*) as total
-- FROM relationship_health_scores
-- UNION ALL
-- SELECT 'communication_events', COUNT(*) FILTER (WHERE org_id IS NULL), COUNT(*) FROM communication_events
-- UNION ALL
-- SELECT 'proposal_jobs', COUNT(*) FILTER (WHERE org_id IS NULL), COUNT(*) FROM proposal_jobs
-- -- ... add more tables as needed
