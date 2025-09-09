-- Google Workspace Integration Tables
-- Create tables for storing Google OAuth tokens and service data

-- Main integration table for OAuth tokens
CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Cached Google Calendars
CREATE TABLE IF NOT EXISTS google_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  time_zone TEXT,
  color_id TEXT,
  is_primary BOOLEAN DEFAULT false,
  access_role TEXT, -- owner, writer, reader
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(integration_id, calendar_id)
);

-- Cached Google Drive Folders
CREATE TABLE IF NOT EXISTS google_drive_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT,
  parent_id TEXT,
  mime_type TEXT DEFAULT 'application/vnd.google-apps.folder',
  web_view_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(integration_id, folder_id)
);

-- Cached Gmail Labels
CREATE TABLE IF NOT EXISTS google_email_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES google_integrations(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT, -- system or user
  message_list_visibility TEXT,
  label_list_visibility TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(integration_id, label_id)
);

-- Google Docs Templates
CREATE TABLE IF NOT EXISTS google_docs_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL, -- proposal, report, invoice, meeting_notes, contract
  template_content JSONB NOT NULL,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Google Service Logs (for debugging and audit)
CREATE TABLE IF NOT EXISTS google_service_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID REFERENCES google_integrations(id) ON DELETE CASCADE,
  service TEXT NOT NULL, -- docs, drive, gmail, calendar
  action TEXT NOT NULL,
  status TEXT NOT NULL, -- success, error, rate_limited
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_google_integrations_user_id ON google_integrations(user_id);
CREATE INDEX idx_google_integrations_email ON google_integrations(email);
CREATE INDEX idx_google_calendars_integration_id ON google_calendars(integration_id);
CREATE INDEX idx_google_drive_folders_integration_id ON google_drive_folders(integration_id);
CREATE INDEX idx_google_email_labels_integration_id ON google_email_labels(integration_id);
CREATE INDEX idx_google_docs_templates_user_id ON google_docs_templates(user_id);
CREATE INDEX idx_google_service_logs_integration_id ON google_service_logs(integration_id);
CREATE INDEX idx_google_service_logs_created_at ON google_service_logs(created_at);

-- Row Level Security
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_docs_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_service_logs ENABLE ROW LEVEL SECURITY;

-- Policies for google_integrations
CREATE POLICY "Users can view their own Google integrations"
  ON google_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google integrations"
  ON google_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google integrations"
  ON google_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google integrations"
  ON google_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for google_calendars
CREATE POLICY "Users can view their own calendars"
  ON google_calendars FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM google_integrations
      WHERE google_integrations.id = google_calendars.integration_id
      AND google_integrations.user_id = auth.uid()
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can view their own drive folders"
  ON google_drive_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM google_integrations
      WHERE google_integrations.id = google_drive_folders.integration_id
      AND google_integrations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own email labels"
  ON google_email_labels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM google_integrations
      WHERE google_integrations.id = google_email_labels.integration_id
      AND google_integrations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own templates"
  ON google_docs_templates FOR ALL
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can view their own service logs"
  ON google_service_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM google_integrations
      WHERE google_integrations.id = google_service_logs.integration_id
      AND google_integrations.user_id = auth.uid()
    )
  );

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_google_tokens()
RETURNS void AS $$
BEGIN
  UPDATE google_integrations
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired tokens (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-google-tokens', '0 * * * *', 'SELECT cleanup_expired_google_tokens();');