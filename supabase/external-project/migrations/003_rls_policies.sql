-- ============================================================================
-- External Project - Row Level Security Policies
-- ============================================================================
-- Purpose: Configure RLS policies for all tables using Clerk authentication
-- All policies use current_user_id() which maps Clerk JWT to profile UUID
-- ============================================================================

-- ============================================================================
-- SECTION 1: Enable RLS on All Tables
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clerk_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_meeting_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_feature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coaching_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tone_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_file_search_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fathom_integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2: Profiles Table Policies
-- ============================================================================

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = current_user_id());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = current_user_id());

-- ============================================================================
-- SECTION 3: Clerk User Mapping Policies (Read-only for users)
-- ============================================================================

CREATE POLICY "clerk_mapping_select_own" ON clerk_user_mapping
    FOR SELECT USING (supabase_user_id = current_user_id());

-- ============================================================================
-- SECTION 4: Organization Memberships Policies
-- ============================================================================

CREATE POLICY "org_memberships_select_own" ON organization_memberships
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "org_memberships_select_same_org" ON organization_memberships
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_memberships
            WHERE user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 5: Companies Table Policies
-- ============================================================================

CREATE POLICY "companies_select_own" ON companies
    FOR SELECT USING (owner_id = current_user_id());

CREATE POLICY "companies_insert_own" ON companies
    FOR INSERT WITH CHECK (owner_id = current_user_id());

CREATE POLICY "companies_update_own" ON companies
    FOR UPDATE USING (owner_id = current_user_id());

CREATE POLICY "companies_delete_own" ON companies
    FOR DELETE USING (owner_id = current_user_id());

-- Allow viewing companies linked to accessible meetings
CREATE POLICY "companies_select_via_meetings" ON companies
    FOR SELECT USING (
        id IN (
            SELECT company_id FROM meetings
            WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 6: Contacts Table Policies
-- ============================================================================

CREATE POLICY "contacts_select_own" ON contacts
    FOR SELECT USING (owner_id = current_user_id());

CREATE POLICY "contacts_insert_own" ON contacts
    FOR INSERT WITH CHECK (owner_id = current_user_id());

CREATE POLICY "contacts_update_own" ON contacts
    FOR UPDATE USING (owner_id = current_user_id());

CREATE POLICY "contacts_delete_own" ON contacts
    FOR DELETE USING (owner_id = current_user_id());

-- Allow viewing contacts linked to accessible meetings
CREATE POLICY "contacts_select_via_meetings" ON contacts
    FOR SELECT USING (
        id IN (
            SELECT contact_id FROM meeting_contacts mc
            JOIN meetings m ON mc.meeting_id = m.id
            WHERE m.owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 7: Meetings Table Policies
-- ============================================================================

CREATE POLICY "meetings_select_own" ON meetings
    FOR SELECT USING (owner_user_id = current_user_id());

CREATE POLICY "meetings_insert_own" ON meetings
    FOR INSERT WITH CHECK (owner_user_id = current_user_id());

CREATE POLICY "meetings_update_own" ON meetings
    FOR UPDATE USING (owner_user_id = current_user_id());

CREATE POLICY "meetings_delete_own" ON meetings
    FOR DELETE USING (owner_user_id = current_user_id());

-- Team meetings visibility (same team)
CREATE POLICY "meetings_select_team" ON meetings
    FOR SELECT USING (
        team_name IS NOT NULL AND team_name IN (
            SELECT team_name FROM meetings
            WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
        )
    );

-- ============================================================================
-- SECTION 8: Meeting Attendees Policies
-- ============================================================================

CREATE POLICY "meeting_attendees_select" ON meeting_attendees
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings
            WHERE owner_user_id = current_user_id()
            OR (team_name IS NOT NULL AND team_name IN (
                SELECT team_name FROM meetings
                WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
            ))
        )
    );

CREATE POLICY "meeting_attendees_manage_own" ON meeting_attendees
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 9: Meeting Action Items Policies
-- ============================================================================

CREATE POLICY "meeting_action_items_select" ON meeting_action_items
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings
            WHERE owner_user_id = current_user_id()
            OR (team_name IS NOT NULL AND team_name IN (
                SELECT team_name FROM meetings
                WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
            ))
        )
    );

CREATE POLICY "meeting_action_items_manage_own" ON meeting_action_items
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 10: Meeting Topics Policies
-- ============================================================================

CREATE POLICY "meeting_topics_select" ON meeting_topics
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings
            WHERE owner_user_id = current_user_id()
            OR (team_name IS NOT NULL AND team_name IN (
                SELECT team_name FROM meetings
                WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
            ))
        )
    );

CREATE POLICY "meeting_topics_manage_own" ON meeting_topics
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 11: Meeting Metrics Policies
-- ============================================================================

CREATE POLICY "meeting_metrics_select" ON meeting_metrics
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings
            WHERE owner_user_id = current_user_id()
            OR (team_name IS NOT NULL AND team_name IN (
                SELECT team_name FROM meetings
                WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
            ))
        )
    );

CREATE POLICY "meeting_metrics_manage_own" ON meeting_metrics
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 12: Meeting Contacts Junction Policies
-- ============================================================================

CREATE POLICY "meeting_contacts_select" ON meeting_contacts
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meetings
            WHERE owner_user_id = current_user_id()
            OR (team_name IS NOT NULL AND team_name IN (
                SELECT team_name FROM meetings
                WHERE owner_user_id = current_user_id() AND team_name IS NOT NULL
            ))
        )
    );

CREATE POLICY "meeting_contacts_manage_own" ON meeting_contacts
    FOR ALL USING (
        meeting_id IN (
            SELECT id FROM meetings WHERE owner_user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 13: Team Meeting Analytics Policies
-- ============================================================================

CREATE POLICY "team_analytics_select_own_org" ON team_meeting_analytics
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_memberships
            WHERE user_id = current_user_id()
        )
    );

-- ============================================================================
-- SECTION 14: User Settings Policies
-- ============================================================================

CREATE POLICY "user_settings_select_own" ON user_settings
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_settings_insert_own" ON user_settings
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_settings_update_own" ON user_settings
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_settings_delete_own" ON user_settings
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 15: User Notifications Policies
-- ============================================================================

CREATE POLICY "user_notifications_select_own" ON user_notifications
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_notifications_insert_own" ON user_notifications
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_notifications_update_own" ON user_notifications
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_notifications_delete_own" ON user_notifications
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 16: User AI Feature Settings Policies
-- ============================================================================

CREATE POLICY "user_ai_settings_select_own" ON user_ai_feature_settings
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_ai_settings_insert_own" ON user_ai_feature_settings
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_ai_settings_update_own" ON user_ai_feature_settings
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_ai_settings_delete_own" ON user_ai_feature_settings
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 17: User Coaching Preferences Policies
-- ============================================================================

CREATE POLICY "user_coaching_select_own" ON user_coaching_preferences
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_coaching_insert_own" ON user_coaching_preferences
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_coaching_update_own" ON user_coaching_preferences
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_coaching_delete_own" ON user_coaching_preferences
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 18: User Tone Settings Policies
-- ============================================================================

CREATE POLICY "user_tone_select_own" ON user_tone_settings
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_tone_insert_own" ON user_tone_settings
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_tone_update_own" ON user_tone_settings
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_tone_delete_own" ON user_tone_settings
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 19: User File Search Stores Policies
-- ============================================================================

CREATE POLICY "user_file_search_select_own" ON user_file_search_stores
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "user_file_search_select_org" ON user_file_search_stores
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_memberships
            WHERE user_id = current_user_id()
        )
    );

CREATE POLICY "user_file_search_insert_own" ON user_file_search_stores
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "user_file_search_update_own" ON user_file_search_stores
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "user_file_search_delete_own" ON user_file_search_stores
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 20: AI Insights Policies
-- ============================================================================

CREATE POLICY "ai_insights_select_own" ON ai_insights
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "ai_insights_insert_own" ON ai_insights
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "ai_insights_update_own" ON ai_insights
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "ai_insights_delete_own" ON ai_insights
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 21: Sentiment Alerts Policies
-- ============================================================================

CREATE POLICY "sentiment_alerts_select_own" ON sentiment_alerts
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "sentiment_alerts_insert_own" ON sentiment_alerts
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "sentiment_alerts_update_own" ON sentiment_alerts
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "sentiment_alerts_delete_own" ON sentiment_alerts
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- SECTION 22: Fathom Integrations Policies
-- ============================================================================

CREATE POLICY "fathom_integrations_select_own" ON fathom_integrations
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY "fathom_integrations_insert_own" ON fathom_integrations
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY "fathom_integrations_update_own" ON fathom_integrations
    FOR UPDATE USING (user_id = current_user_id());

CREATE POLICY "fathom_integrations_delete_own" ON fathom_integrations
    FOR DELETE USING (user_id = current_user_id());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    RAISE NOTICE 'RLS policies created successfully. Total policies: %', v_policy_count;
END;
$$;

-- List all policies for verification
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
