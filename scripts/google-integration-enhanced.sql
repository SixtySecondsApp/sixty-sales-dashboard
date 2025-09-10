-- Google Integration Enhanced Schema
-- Adds email/meeting tracking and document management

-- ============================================
-- 1. Contact Emails Table
-- ============================================
-- Stores synced emails from Gmail for each contact
CREATE TABLE IF NOT EXISTS contact_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  gmail_message_id VARCHAR(255) UNIQUE NOT NULL, -- Gmail's unique message ID
  gmail_thread_id VARCHAR(255) NOT NULL,
  
  -- Email metadata
  subject TEXT,
  snippet TEXT, -- Gmail's snippet/preview
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_emails TEXT[], -- Array of recipient emails
  cc_emails TEXT[],
  bcc_emails TEXT[],
  
  -- Email content
  body_html TEXT,
  body_plain TEXT,
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking metadata
  direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
  is_read BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  labels TEXT[], -- Gmail labels
  
  -- Sync metadata
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contact_emails_contact_id ON contact_emails(contact_id);
CREATE INDEX idx_contact_emails_integration_id ON contact_emails(integration_id);
CREATE INDEX idx_contact_emails_sent_at ON contact_emails(sent_at DESC);
CREATE INDEX idx_contact_emails_gmail_message_id ON contact_emails(gmail_message_id);
CREATE INDEX idx_contact_emails_from_email ON contact_emails(from_email);

-- ============================================
-- 2. Contact Meetings Table
-- ============================================
-- Stores synced calendar events/meetings for each contact
CREATE TABLE IF NOT EXISTS contact_meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  google_event_id VARCHAR(255) UNIQUE NOT NULL, -- Google Calendar event ID
  
  -- Meeting details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  meeting_link VARCHAR(500), -- Zoom/Meet/Teams link
  
  -- Time information
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(100),
  is_all_day BOOLEAN DEFAULT false,
  
  -- Attendees
  organizer_email VARCHAR(255),
  organizer_name VARCHAR(255),
  attendees JSONB, -- Array of {email, name, status, optional}
  
  -- Status
  status VARCHAR(50) CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  visibility VARCHAR(50) CHECK (visibility IN ('default', 'public', 'private', 'confidential')),
  
  -- Meeting type
  meeting_type VARCHAR(50) CHECK (meeting_type IN ('call', 'video', 'in_person', 'other')),
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  recurring_event_id VARCHAR(255),
  
  -- Sync metadata
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contact_meetings_contact_id ON contact_meetings(contact_id);
CREATE INDEX idx_contact_meetings_integration_id ON contact_meetings(integration_id);
CREATE INDEX idx_contact_meetings_start_time ON contact_meetings(start_time DESC);
CREATE INDEX idx_contact_meetings_google_event_id ON contact_meetings(google_event_id);
CREATE INDEX idx_contact_meetings_organizer_email ON contact_meetings(organizer_email);

-- ============================================
-- 3. Google Documents Table
-- ============================================
-- Stores references to Google Docs created or associated with contacts
CREATE TABLE IF NOT EXISTS contact_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  
  -- Document information
  google_doc_id VARCHAR(255) UNIQUE NOT NULL,
  document_name VARCHAR(500) NOT NULL,
  document_type VARCHAR(50) CHECK (document_type IN ('document', 'spreadsheet', 'presentation', 'form')),
  
  -- URLs
  document_url TEXT NOT NULL,
  export_url TEXT, -- For PDF export
  
  -- Metadata
  description TEXT,
  folder_id VARCHAR(255), -- Google Drive folder ID
  folder_path TEXT,
  
  -- Permissions
  is_shared BOOLEAN DEFAULT false,
  shared_with TEXT[], -- Array of email addresses
  permission_level VARCHAR(50) CHECK (permission_level IN ('view', 'comment', 'edit')),
  
  -- Template information (if created from template)
  template_id VARCHAR(255),
  template_name VARCHAR(500),
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_contact_documents_contact_id ON contact_documents(contact_id);
CREATE INDEX idx_contact_documents_deal_id ON contact_documents(deal_id);
CREATE INDEX idx_contact_documents_integration_id ON contact_documents(integration_id);
CREATE INDEX idx_contact_documents_google_doc_id ON contact_documents(google_doc_id);
CREATE INDEX idx_contact_documents_status ON contact_documents(status);

-- ============================================
-- 4. Email Sync Status Table
-- ============================================
-- Tracks the sync status for each integration
CREATE TABLE IF NOT EXISTS email_sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID UNIQUE NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  
  -- Sync state
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_history_id VARCHAR(255), -- Gmail history ID for incremental sync
  next_page_token TEXT, -- For pagination
  
  -- Statistics
  total_emails_synced INTEGER DEFAULT 0,
  total_meetings_synced INTEGER DEFAULT 0,
  
  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT true,
  sync_interval_minutes INTEGER DEFAULT 15,
  sync_direction VARCHAR(20) DEFAULT 'both' CHECK (sync_direction IN ('inbound', 'outbound', 'both')),
  
  -- Error tracking
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  consecutive_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Workflow Google Actions Table
-- ============================================
-- Stores configuration for Google actions in workflows
CREATE TABLE IF NOT EXISTS workflow_google_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  
  -- Action type
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('send_email', 'create_event', 'create_document')),
  
  -- Configuration (JSON)
  config JSONB NOT NULL,
  /* 
    For send_email: {
      to: string[],
      cc?: string[],
      bcc?: string[],
      subject: string,
      body: string,
      isHtml: boolean
    }
    
    For create_event: {
      title: string,
      description?: string,
      startTime: string,
      endTime: string,
      attendees: string[],
      location?: string,
      meetingLink?: string
    }
    
    For create_document: {
      name: string,
      type: 'document' | 'spreadsheet' | 'presentation',
      templateId?: string,
      folderId?: string,
      content?: string,
      shareWith?: string[]
    }
  */
  
  -- Execution tracking
  last_executed_at TIMESTAMP WITH TIME ZONE,
  execution_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_workflow_google_actions_workflow_id ON workflow_google_actions(workflow_id);
CREATE INDEX idx_workflow_google_actions_node_id ON workflow_google_actions(node_id);

-- ============================================
-- 6. Update google_integrations table
-- ============================================
-- Add refresh token if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'google_integrations' 
    AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE google_integrations ADD COLUMN refresh_token TEXT;
  END IF;
END $$;

-- ============================================
-- 7. Row Level Security Policies
-- ============================================

-- Contact Emails policies
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view emails for their contacts" ON contact_emails
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_emails.contact_id 
      AND contacts.owner_id = auth.uid()
    )
  );

-- Contact Meetings policies  
ALTER TABLE contact_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view meetings for their contacts" ON contact_meetings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_meetings.contact_id 
      AND contacts.owner_id = auth.uid()
    )
  );

-- Contact Documents policies
ALTER TABLE contact_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents for their contacts" ON contact_documents
  FOR SELECT USING (
    (contact_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_documents.contact_id 
      AND contacts.owner_id = auth.uid()
    )) OR
    (deal_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM deals 
      WHERE deals.id = contact_documents.deal_id 
      AND deals.owner_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create documents" ON contact_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_integrations 
      WHERE google_integrations.id = contact_documents.integration_id 
      AND google_integrations.user_id = auth.uid()
    )
  );

-- Email Sync Status policies
ALTER TABLE email_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their sync status" ON email_sync_status
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM google_integrations 
      WHERE google_integrations.id = email_sync_status.integration_id 
      AND google_integrations.user_id = auth.uid()
    )
  );

-- Workflow Google Actions policies
ALTER TABLE workflow_google_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workflow actions" ON workflow_google_actions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_google_actions.workflow_id 
      AND workflows.user_id = auth.uid()
    )
  );

-- ============================================
-- 8. Functions for Email/Meeting Matching
-- ============================================

-- Function to match emails to contacts
CREATE OR REPLACE FUNCTION match_email_to_contact(
  p_email VARCHAR(255),
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  SELECT id INTO v_contact_id
  FROM contacts
  WHERE LOWER(email) = LOWER(p_email)
    AND owner_id = p_user_id
  LIMIT 1;
  
  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql;

-- Function to sync email to contact
CREATE OR REPLACE FUNCTION sync_email_to_contact(
  p_integration_id UUID,
  p_gmail_message_id VARCHAR(255),
  p_from_email VARCHAR(255),
  p_to_emails TEXT[],
  p_subject TEXT,
  p_body_plain TEXT,
  p_sent_at TIMESTAMP WITH TIME ZONE,
  p_direction VARCHAR(10)
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_contact_id UUID;
  v_email_id UUID;
  v_target_email VARCHAR(255);
BEGIN
  -- Get user_id from integration
  SELECT user_id INTO v_user_id
  FROM google_integrations
  WHERE id = p_integration_id;
  
  -- Determine which email to match (from for inbound, first to for outbound)
  IF p_direction = 'inbound' THEN
    v_target_email := p_from_email;
  ELSE
    v_target_email := p_to_emails[1];
  END IF;
  
  -- Match to contact
  v_contact_id := match_email_to_contact(v_target_email, v_user_id);
  
  -- Only insert if we found a matching contact
  IF v_contact_id IS NOT NULL THEN
    INSERT INTO contact_emails (
      contact_id,
      integration_id,
      gmail_message_id,
      gmail_thread_id,
      subject,
      from_email,
      to_emails,
      body_plain,
      sent_at,
      direction
    ) VALUES (
      v_contact_id,
      p_integration_id,
      p_gmail_message_id,
      '', -- Thread ID would be passed in real implementation
      p_subject,
      p_from_email,
      p_to_emails,
      p_body_plain,
      p_sent_at,
      p_direction
    )
    ON CONFLICT (gmail_message_id) DO UPDATE
    SET 
      subject = EXCLUDED.subject,
      body_plain = EXCLUDED.body_plain,
      updated_at = NOW()
    RETURNING id INTO v_email_id;
  END IF;
  
  RETURN v_email_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Triggers for Updated Timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for new tables
CREATE TRIGGER update_contact_emails_updated_at BEFORE UPDATE ON contact_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_meetings_updated_at BEFORE UPDATE ON contact_meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_documents_updated_at BEFORE UPDATE ON contact_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_sync_status_updated_at BEFORE UPDATE ON email_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_google_actions_updated_at BEFORE UPDATE ON workflow_google_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Success message
-- ============================================
DO $$ 
BEGIN 
  RAISE NOTICE 'Google Integration Enhanced schema created successfully!';
  RAISE NOTICE 'Tables created: contact_emails, contact_meetings, contact_documents, email_sync_status, workflow_google_actions';
  RAISE NOTICE 'Run this script in your Supabase SQL editor to set up the enhanced Google integration.';
END $$;