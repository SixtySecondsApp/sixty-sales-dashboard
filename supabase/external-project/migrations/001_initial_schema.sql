-- ============================================================================
-- External Project - Initial Schema Migration
-- ============================================================================
-- Project: cregubixyglvfzvtlgit (Customer-Facing External View)
-- Purpose: Create streamlined schema for customer-facing features only
-- Features: Meetings, Meeting Intelligence, Team Analytics, Settings, Profile
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: USER & AUTH TABLES
-- ============================================================================

-- Profiles table (user identity)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT,
    department TEXT,
    stage TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    username TEXT,
    website TEXT
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin);

-- Clerk user mapping (maps Clerk user IDs to profile UUIDs)
CREATE TABLE clerk_user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    clerk_user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    migrated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clerk_user_mapping_clerk_id ON clerk_user_mapping(clerk_user_id);
CREATE INDEX idx_clerk_user_mapping_email ON clerk_user_mapping(email);
CREATE INDEX idx_clerk_user_mapping_supabase_id ON clerk_user_mapping(supabase_user_id);

-- Organization memberships (for team features)
CREATE TABLE organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_org_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org_id ON organization_memberships(organization_id);

-- ============================================================================
-- SECTION 2: CRM CONTEXT TABLES (Meeting-Related)
-- ============================================================================

-- Companies table (linked to meetings)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    industry TEXT,
    size TEXT CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    website TEXT,
    address TEXT,
    phone TEXT,
    description TEXT,
    linkedin_url TEXT,
    owner_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_owner_id ON companies(owner_id);
CREATE INDEX idx_companies_name ON companies(name);

-- Contacts table (linked to meetings)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT,
    last_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (
        CASE
            WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
            WHEN first_name IS NOT NULL THEN first_name
            WHEN last_name IS NOT NULL THEN last_name
            ELSE NULL
        END
    ) STORED,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    title TEXT,
    linkedin_url TEXT,
    is_primary BOOLEAN DEFAULT false,
    owner_id UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_owner_id ON contacts(owner_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_full_name ON contacts(full_name);

-- ============================================================================
-- SECTION 3: MEETINGS TABLES
-- ============================================================================

-- Main meetings table
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fathom_recording_id TEXT UNIQUE NOT NULL,
    title TEXT,
    share_url TEXT,
    calls_url TEXT,
    meeting_start TIMESTAMPTZ,
    meeting_end TIMESTAMPTZ,
    duration_minutes NUMERIC,
    owner_user_id UUID REFERENCES profiles(id),
    owner_email TEXT,
    team_name TEXT,
    company_id UUID REFERENCES companies(id),
    primary_contact_id UUID REFERENCES contacts(id),
    summary TEXT,
    transcript_doc_url TEXT,
    transcript_text TEXT,
    sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    coach_rating NUMERIC CHECK (coach_rating >= 0 AND coach_rating <= 100),
    coach_summary TEXT,
    talk_time_rep_pct NUMERIC,
    talk_time_customer_pct NUMERIC,
    talk_time_judgement TEXT CHECK (talk_time_judgement IN ('good', 'high', 'low')),
    fathom_embed_url TEXT,
    ai_training_metadata JSONB,
    fathom_created_at TIMESTAMPTZ,
    transcript_language TEXT,
    calendar_invitees_type TEXT CHECK (calendar_invitees_type IN ('all_internal', 'one_or_more_external')),
    fathom_user_id TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetings_owner_user_id ON meetings(owner_user_id);
CREATE INDEX idx_meetings_meeting_start ON meetings(meeting_start DESC);
CREATE INDEX idx_meetings_company_id ON meetings(company_id);
CREATE INDEX idx_meetings_fathom_recording_id ON meetings(fathom_recording_id);

-- Meeting attendees
CREATE TABLE meeting_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    is_external BOOLEAN DEFAULT false,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_attendees_meeting_id ON meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_attendees_email ON meeting_attendees(email);

-- Meeting action items (AI-extracted)
CREATE TABLE meeting_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    assignee_name TEXT,
    assignee_email TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category TEXT,
    deadline_at TIMESTAMPTZ,
    completed BOOLEAN DEFAULT false,
    ai_generated BOOLEAN DEFAULT false,
    timestamp_seconds NUMERIC,
    playback_url TEXT,
    synced_to_task BOOLEAN DEFAULT false,
    sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'failed', 'excluded')),
    sync_error TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_action_items_meeting_id ON meeting_action_items(meeting_id);
CREATE INDEX idx_meeting_action_items_assignee_email ON meeting_action_items(assignee_email);
CREATE INDEX idx_meeting_action_items_completed ON meeting_action_items(completed);

-- Meeting topics (keywords/topics from meetings)
CREATE TABLE meeting_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_topics_meeting_id ON meeting_topics(meeting_id);
CREATE INDEX idx_meeting_topics_label ON meeting_topics(label);

-- Meeting metrics (talk time & speech analysis)
CREATE TABLE meeting_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    words_spoken_rep INTEGER,
    words_spoken_customer INTEGER,
    avg_response_latency_ms INTEGER,
    interruption_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_metrics_meeting_id ON meeting_metrics(meeting_id);

-- Meeting contacts junction table
CREATE TABLE meeting_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meeting_id, contact_id)
);

CREATE INDEX idx_meeting_contacts_meeting_id ON meeting_contacts(meeting_id);
CREATE INDEX idx_meeting_contacts_contact_id ON meeting_contacts(contact_id);

-- Team meeting analytics (pre-aggregated metrics)
CREATE TABLE team_meeting_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_meetings INTEGER DEFAULT 0,
    total_duration_minutes NUMERIC DEFAULT 0,
    avg_sentiment_score NUMERIC,
    avg_coach_rating NUMERIC,
    avg_talk_time_rep_pct NUMERIC,
    total_action_items INTEGER DEFAULT 0,
    completed_action_items INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_meeting_analytics_org_id ON team_meeting_analytics(organization_id);
CREATE INDEX idx_team_meeting_analytics_period ON team_meeting_analytics(period_start, period_end);

-- ============================================================================
-- SECTION 4: USER SETTINGS TABLES
-- ============================================================================

-- General user settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark', 'system')),
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- User notification preferences
CREATE TABLE user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    meeting_reminders BOOLEAN DEFAULT true,
    action_item_alerts BOOLEAN DEFAULT true,
    weekly_digest BOOLEAN DEFAULT true,
    sentiment_alerts BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);

-- User AI feature settings
CREATE TABLE user_ai_feature_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    auto_summarize BOOLEAN DEFAULT true,
    auto_extract_action_items BOOLEAN DEFAULT true,
    sentiment_analysis BOOLEAN DEFAULT true,
    coaching_insights BOOLEAN DEFAULT true,
    talk_time_analysis BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_ai_settings_user_id ON user_ai_feature_settings(user_id);

-- User coaching preferences
CREATE TABLE user_coaching_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    target_talk_time_pct NUMERIC DEFAULT 40,
    target_sentiment_score NUMERIC DEFAULT 0.5,
    coaching_focus_areas TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_coaching_user_id ON user_coaching_preferences(user_id);

-- User tone settings
CREATE TABLE user_tone_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    preferred_tone TEXT DEFAULT 'professional' CHECK (preferred_tone IN ('professional', 'casual', 'friendly', 'formal')),
    formality_level INTEGER DEFAULT 5 CHECK (formality_level >= 1 AND formality_level <= 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_tone_user_id ON user_tone_settings(user_id);

-- ============================================================================
-- SECTION 5: INTELLIGENCE & SEARCH TABLES
-- ============================================================================

-- User file search stores (for AI search/RAG)
CREATE TABLE user_file_search_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID,
    store_id TEXT NOT NULL,
    store_name TEXT,
    file_count INTEGER DEFAULT 0,
    last_synced_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'error', 'deleted')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_file_search_user_id ON user_file_search_stores(user_id);
CREATE INDEX idx_user_file_search_org_id ON user_file_search_stores(organization_id);
CREATE INDEX idx_user_file_search_store_id ON user_file_search_stores(store_id);

-- AI insights
CREATE TABLE ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('summary', 'suggestion', 'warning', 'opportunity', 'trend')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
    is_read BOOLEAN DEFAULT false,
    is_actionable BOOLEAN DEFAULT false,
    action_taken BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_meeting_id ON ai_insights(meeting_id);
CREATE INDEX idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX idx_ai_insights_is_read ON ai_insights(is_read);

-- Sentiment alerts
CREATE TABLE sentiment_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('negative_trend', 'low_score', 'high_score', 'improvement')),
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    sentiment_score NUMERIC,
    threshold_value NUMERIC,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentiment_alerts_user_id ON sentiment_alerts(user_id);
CREATE INDEX idx_sentiment_alerts_meeting_id ON sentiment_alerts(meeting_id);
CREATE INDEX idx_sentiment_alerts_acknowledged ON sentiment_alerts(is_acknowledged);

-- ============================================================================
-- SECTION 6: INTEGRATION STATUS TABLES
-- ============================================================================

-- Fathom integrations (read-only status)
CREATE TABLE fathom_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    fathom_user_id TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    is_connected BOOLEAN DEFAULT false,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')),
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fathom_integrations_user_id ON fathom_integrations(user_id);
CREATE INDEX idx_fathom_integrations_connected ON fathom_integrations(is_connected);

-- ============================================================================
-- SECTION 7: TRIGGERS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clerk_user_mapping_updated_at
    BEFORE UPDATE ON clerk_user_mapping
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_memberships_updated_at
    BEFORE UPDATE ON organization_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_action_items_updated_at
    BEFORE UPDATE ON meeting_action_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_meeting_analytics_updated_at
    BEFORE UPDATE ON team_meeting_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notifications_updated_at
    BEFORE UPDATE ON user_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_feature_settings_updated_at
    BEFORE UPDATE ON user_ai_feature_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_coaching_preferences_updated_at
    BEFORE UPDATE ON user_coaching_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tone_settings_updated_at
    BEFORE UPDATE ON user_tone_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_file_search_stores_updated_at
    BEFORE UPDATE ON user_file_search_stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_insights_updated_at
    BEFORE UPDATE ON ai_insights
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fathom_integrations_updated_at
    BEFORE UPDATE ON fathom_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    RAISE NOTICE 'External project schema created successfully. Total tables: %', v_table_count;
END;
$$;
