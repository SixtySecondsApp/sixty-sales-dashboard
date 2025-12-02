-- =====================================================
-- Multi-Tenant: Auto-Set org_id Triggers
-- =====================================================
-- These triggers automatically set org_id on INSERT
-- for all tenant-scoped tables, ensuring data isolation.

-- =====================================================
-- 1. Generic Auto-Set org_id Function
-- =====================================================
-- For tables that should use the user's active organization

CREATE OR REPLACE FUNCTION auto_set_org_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If org_id already set, validate access
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Auto-set from user's active organization
  NEW.org_id := get_user_active_org();

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization. User must belong to an organization.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_set_org_id() IS 'Auto-sets org_id from user active org on INSERT';

-- =====================================================
-- 2. Inherit org_id from Deal
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_deal()
RETURNS TRIGGER AS $$
BEGIN
  -- If org_id already set, validate
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Inherit from deal
  IF NEW.deal_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM deals WHERE id = NEW.deal_id;
  END IF;

  -- Fallback to user's active org
  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from deal or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. Inherit org_id from Contact
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.contact_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM contacts WHERE id = NEW.contact_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from contact or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. Inherit org_id from Company
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.company_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM companies WHERE id = NEW.company_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from company or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. Inherit org_id from Meeting
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_meeting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.meeting_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM meetings WHERE id = NEW.meeting_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from meeting or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. Inherit org_id from Activity
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.activity_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM activities WHERE id = NEW.activity_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from activity or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. Inherit org_id from Relationship Health Score
-- =====================================================

CREATE OR REPLACE FUNCTION auto_set_org_id_from_health_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    IF NOT can_write_to_org(NEW.org_id) THEN
      RAISE EXCEPTION 'User does not have write access to organization %', NEW.org_id;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.relationship_health_id IS NOT NULL THEN
    SELECT org_id INTO NEW.org_id FROM relationship_health_scores WHERE id = NEW.relationship_health_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := get_user_active_org();
  END IF;

  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization from health score or user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Apply Triggers to Core CRM Tables
-- =====================================================

-- Drop existing triggers first (if any)
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deals ON deals;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_tasks ON tasks;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_activities ON activities;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_contacts ON contacts;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_companies ON companies;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_leads ON leads;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_clients ON clients;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_meetings ON meetings;
DROP TRIGGER IF EXISTS trigger_auto_set_org_id_calendar_events ON calendar_events;

-- Core CRM tables - use generic auto_set_org_id
CREATE TRIGGER trigger_auto_set_org_id_deals
  BEFORE INSERT ON deals FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_tasks
  BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_activities
  BEFORE INSERT ON activities FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_contacts
  BEFORE INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_companies
  BEFORE INSERT ON companies FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_leads
  BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_clients
  BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_meetings
  BEFORE INSERT ON meetings FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

CREATE TRIGGER trigger_auto_set_org_id_calendar_events
  BEFORE INSERT ON calendar_events FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();

-- =====================================================
-- Apply Triggers to Child/Junction Tables
-- =====================================================

-- Deal child tables - inherit from deal
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_splits') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_splits ON deal_splits;
    CREATE TRIGGER trigger_auto_set_org_id_deal_splits
      BEFORE INSERT ON deal_splits FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_notes') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_notes ON deal_notes;
    CREATE TRIGGER trigger_auto_set_org_id_deal_notes
      BEFORE INSERT ON deal_notes FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_meetings') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_meetings ON deal_meetings;
    CREATE TRIGGER trigger_auto_set_org_id_deal_meetings
      BEFORE INSERT ON deal_meetings FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stakeholders') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_stakeholders ON deal_stakeholders;
    CREATE TRIGGER trigger_auto_set_org_id_deal_stakeholders
      BEFORE INSERT ON deal_stakeholders FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_activities') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_activities ON deal_activities;
    CREATE TRIGGER trigger_auto_set_org_id_deal_activities
      BEFORE INSERT ON deal_activities FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deal_stage_history') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_deal_stage_history ON deal_stage_history;
    CREATE TRIGGER trigger_auto_set_org_id_deal_stage_history
      BEFORE INSERT ON deal_stage_history FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_deal();
  END IF;
END $$;

-- Contact child tables - inherit from contact
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_notes') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_contact_notes ON contact_notes;
    CREATE TRIGGER trigger_auto_set_org_id_contact_notes
      BEFORE INSERT ON contact_notes FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_contact();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_interactions') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_contact_interactions ON contact_interactions;
    CREATE TRIGGER trigger_auto_set_org_id_contact_interactions
      BEFORE INSERT ON contact_interactions FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_contact();
  END IF;
END $$;

-- Company child tables - inherit from company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_notes') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_company_notes ON company_notes;
    CREATE TRIGGER trigger_auto_set_org_id_company_notes
      BEFORE INSERT ON company_notes FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_company();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_activities') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_company_activities ON company_activities;
    CREATE TRIGGER trigger_auto_set_org_id_company_activities
      BEFORE INSERT ON company_activities FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_company();
  END IF;
END $$;

-- Meeting child tables - inherit from meeting
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_meetings') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_activity_meetings ON activity_meetings;
    CREATE TRIGGER trigger_auto_set_org_id_activity_meetings
      BEFORE INSERT ON activity_meetings FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_meeting();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_sequences') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_meeting_sequences ON meeting_sequences;
    CREATE TRIGGER trigger_auto_set_org_id_meeting_sequences
      BEFORE INSERT ON meeting_sequences FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_meeting();
  END IF;
END $$;

-- Relationship health child tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ghost_detection_signals') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_ghost_detection_signals ON ghost_detection_signals;
    CREATE TRIGGER trigger_auto_set_org_id_ghost_detection_signals
      BEFORE INSERT ON ghost_detection_signals FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_health_score();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'interventions') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_interventions ON interventions;
    CREATE TRIGGER trigger_auto_set_org_id_interventions
      BEFORE INSERT ON interventions FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_health_score();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationship_health_history') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_relationship_health_history ON relationship_health_history;
    CREATE TRIGGER trigger_auto_set_org_id_relationship_health_history
      BEFORE INSERT ON relationship_health_history FOR EACH ROW EXECUTE FUNCTION auto_set_org_id_from_health_score();
  END IF;
END $$;

-- =====================================================
-- Apply Triggers to User-Owned Tables (generic)
-- =====================================================

DO $$
BEGIN
  -- User settings/preferences tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_writing_styles') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_user_writing_styles ON user_writing_styles;
    CREATE TRIGGER trigger_auto_set_org_id_user_writing_styles
      BEFORE INSERT ON user_writing_styles FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_onboarding_progress') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_user_onboarding_progress ON user_onboarding_progress;
    CREATE TRIGGER trigger_auto_set_org_id_user_onboarding_progress
      BEFORE INSERT ON user_onboarding_progress FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  -- Proposal/template tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_jobs') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_proposal_jobs ON proposal_jobs;
    CREATE TRIGGER trigger_auto_set_org_id_proposal_jobs
      BEFORE INSERT ON proposal_jobs FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_templates') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_sales_templates ON sales_templates;
    CREATE TRIGGER trigger_auto_set_org_id_sales_templates
      BEFORE INSERT ON sales_templates FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  -- Communication tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_events') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_communication_events ON communication_events;
    CREATE TRIGGER trigger_auto_set_org_id_communication_events
      BEFORE INSERT ON communication_events FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_emails') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_scheduled_emails ON scheduled_emails;
    CREATE TRIGGER trigger_auto_set_org_id_scheduled_emails
      BEFORE INSERT ON scheduled_emails FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  -- Meeting intelligence tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'relationship_health_scores') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_relationship_health_scores ON relationship_health_scores;
    CREATE TRIGGER trigger_auto_set_org_id_relationship_health_scores
      BEFORE INSERT ON relationship_health_scores FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentiment_alerts') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_sentiment_alerts ON sentiment_alerts;
    CREATE TRIGGER trigger_auto_set_org_id_sentiment_alerts
      BEFORE INSERT ON sentiment_alerts FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  -- Workflow tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_executions') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_workflow_executions ON workflow_executions;
    CREATE TRIGGER trigger_auto_set_org_id_workflow_executions
      BEFORE INSERT ON workflow_executions FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_automation_rules') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_user_automation_rules ON user_automation_rules;
    CREATE TRIGGER trigger_auto_set_org_id_user_automation_rules
      BEFORE INSERT ON user_automation_rules FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'smart_task_templates') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_smart_task_templates ON smart_task_templates;
    CREATE TRIGGER trigger_auto_set_org_id_smart_task_templates
      BEFORE INSERT ON smart_task_templates FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  -- Integration tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_integrations') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_google_integrations ON google_integrations;
    CREATE TRIGGER trigger_auto_set_org_id_google_integrations
      BEFORE INSERT ON google_integrations FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_calendars') THEN
    DROP TRIGGER IF EXISTS trigger_auto_set_org_id_calendar_calendars ON calendar_calendars;
    CREATE TRIGGER trigger_auto_set_org_id_calendar_calendars
      BEFORE INSERT ON calendar_calendars FOR EACH ROW EXECUTE FUNCTION auto_set_org_id();
  END IF;

END $$;

-- Comments
COMMENT ON FUNCTION auto_set_org_id_from_deal() IS 'Inherits org_id from related deal';
COMMENT ON FUNCTION auto_set_org_id_from_contact() IS 'Inherits org_id from related contact';
COMMENT ON FUNCTION auto_set_org_id_from_company() IS 'Inherits org_id from related company';
COMMENT ON FUNCTION auto_set_org_id_from_meeting() IS 'Inherits org_id from related meeting';
COMMENT ON FUNCTION auto_set_org_id_from_activity() IS 'Inherits org_id from related activity';
COMMENT ON FUNCTION auto_set_org_id_from_health_score() IS 'Inherits org_id from related relationship_health_scores';
