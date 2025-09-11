-- Migration: Email & Calendar System with MCP Integration
-- Description: Complete schema for email, calendar, and MCP server integration

-- MCP Connections table for OAuth and service configurations
CREATE TABLE IF NOT EXISTS mcp_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('gmail', 'outlook', 'calendar', 'google_calendar')),
    credentials JSONB NOT NULL, -- Encrypted OAuth tokens
    settings JSONB DEFAULT '{}',
    last_sync TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, service_type)
);

-- Email threads for conversation grouping
CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    participants JSONB NOT NULL DEFAULT '[]',
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_count INT DEFAULT 1,
    is_read BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email labels for categorization
CREATE TABLE IF NOT EXISTS email_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#808080',
    icon TEXT,
    type TEXT DEFAULT 'custom' CHECK (type IN ('system', 'custom', 'smart')),
    visibility BOOLEAN DEFAULT true,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Main emails table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT, -- Gmail/Outlook message ID
    thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mcp_connection_id UUID REFERENCES mcp_connections(id) ON DELETE SET NULL,
    
    -- Email fields
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails JSONB NOT NULL DEFAULT '[]',
    cc_emails JSONB DEFAULT '[]',
    bcc_emails JSONB DEFAULT '[]',
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    headers JSONB DEFAULT '{}',
    
    -- Status fields
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    is_draft BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    is_trash BOOLEAN DEFAULT false,
    
    -- AI fields
    ai_summary TEXT,
    ai_category TEXT,
    ai_priority INT DEFAULT 3 CHECK (ai_priority BETWEEN 1 AND 5),
    ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
    ai_action_required BOOLEAN DEFAULT false,
    
    -- Metadata
    labels JSONB DEFAULT '[]',
    attachments_count INT DEFAULT 0,
    workflow_metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email attachments
CREATE TABLE IF NOT EXISTS email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_url TEXT,
    content_id TEXT, -- For inline images
    is_inline BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB DEFAULT '[]', -- Template variables
    category TEXT,
    is_public BOOLEAN DEFAULT false,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Calendar calendars
CREATE TABLE IF NOT EXISTS calendar_calendars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    external_id TEXT, -- Google Calendar ID
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#4285F4',
    timezone TEXT DEFAULT 'UTC',
    is_primary BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT, -- Google Calendar event ID
    calendar_id UUID NOT NULL REFERENCES calendar_calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mcp_connection_id UUID REFERENCES mcp_connections(id) ON DELETE SET NULL,
    
    -- Event details
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    
    -- Recurrence
    recurrence_rule TEXT, -- RRULE format
    recurrence_id UUID, -- Parent event for recurring instances
    
    -- Meeting details
    meeting_url TEXT,
    meeting_provider TEXT, -- zoom, meet, teams
    meeting_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    visibility TEXT DEFAULT 'default' CHECK (visibility IN ('default', 'public', 'private')),
    busy_status TEXT DEFAULT 'busy' CHECK (busy_status IN ('busy', 'free')),
    
    -- AI fields
    ai_generated BOOLEAN DEFAULT false,
    ai_suggested_time BOOLEAN DEFAULT false,
    meeting_prep JSONB DEFAULT '{}',
    
    -- Integration
    deal_id UUID, -- Link to CRM deals
    workflow_id UUID,
    
    -- Metadata
    color TEXT,
    reminders JSONB DEFAULT '[]',
    attendees_count INT DEFAULT 0,
    response_status TEXT CHECK (response_status IN ('needsAction', 'accepted', 'declined', 'tentative')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar attendees
CREATE TABLE IF NOT EXISTS calendar_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    is_organizer BOOLEAN DEFAULT false,
    is_required BOOLEAN DEFAULT true,
    response_status TEXT DEFAULT 'needsAction' CHECK (response_status IN ('needsAction', 'accepted', 'declined', 'tentative')),
    comment TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, email)
);

-- Calendar reminders
CREATE TABLE IF NOT EXISTS calendar_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    minutes_before INT NOT NULL CHECK (minutes_before >= 0),
    type TEXT DEFAULT 'popup' CHECK (type IN ('email', 'popup', 'sms')),
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow MCP logs
CREATE TABLE IF NOT EXISTS workflow_mcp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mcp_server TEXT NOT NULL,
    operation TEXT NOT NULL,
    params JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'pending')),
    error_message TEXT,
    duration_ms INT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email-Label junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS email_label_map (
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (email_id, label_id)
);

-- Indexes for performance
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_ai_priority ON emails(ai_priority);
CREATE INDEX idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_email_threads_last_message ON email_threads(last_message_at DESC);
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_calendar_id ON calendar_events(calendar_id);
CREATE INDEX idx_mcp_connections_user_id ON mcp_connections(user_id);

-- RLS Policies
ALTER TABLE mcp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_mcp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_label_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies for each table
CREATE POLICY "Users can manage their own MCP connections" ON mcp_connections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own email threads" ON email_threads
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own email labels" ON email_labels
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own emails" ON emails
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view email attachments for their emails" ON email_attachments
    FOR ALL USING (EXISTS (
        SELECT 1 FROM emails WHERE emails.id = email_attachments.email_id AND emails.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage their own email templates" ON email_templates
    FOR ALL USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage their own calendars" ON calendar_calendars
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own calendar events" ON calendar_events
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage attendees for their events" ON calendar_attendees
    FOR ALL USING (EXISTS (
        SELECT 1 FROM calendar_events WHERE calendar_events.id = calendar_attendees.event_id AND calendar_events.user_id = auth.uid()
    ));

CREATE POLICY "Users can manage reminders for their events" ON calendar_reminders
    FOR ALL USING (EXISTS (
        SELECT 1 FROM calendar_events WHERE calendar_events.id = calendar_reminders.event_id AND calendar_events.user_id = auth.uid()
    ));

CREATE POLICY "Users can view their own workflow logs" ON workflow_mcp_logs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their email labels mapping" ON email_label_map
    FOR ALL USING (EXISTS (
        SELECT 1 FROM emails WHERE emails.id = email_label_map.email_id AND emails.user_id = auth.uid()
    ));

-- Functions and Triggers

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_mcp_connections_updated_at BEFORE UPDATE ON mcp_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_calendars_updated_at BEFORE UPDATE ON calendar_calendars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update thread metadata when email is added
CREATE OR REPLACE FUNCTION update_thread_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE email_threads
    SET 
        last_message_at = NEW.received_at,
        message_count = message_count + 1,
        is_read = CASE WHEN NEW.is_read THEN is_read ELSE false END
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_on_email_insert AFTER INSERT ON emails
    FOR EACH ROW WHEN (NEW.thread_id IS NOT NULL)
    EXECUTE FUNCTION update_thread_metadata();

-- Insert default system labels
INSERT INTO email_labels (user_id, name, color, type, position) 
SELECT 
    auth.uid(),
    label.name,
    label.color,
    'system',
    label.position
FROM (VALUES 
    ('Inbox', '#4285F4', 1),
    ('Sent', '#34A853', 2),
    ('Drafts', '#FBBC04', 3),
    ('Important', '#EA4335', 4),
    ('Spam', '#666666', 5),
    ('Trash', '#333333', 6)
) AS label(name, color, position)
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;