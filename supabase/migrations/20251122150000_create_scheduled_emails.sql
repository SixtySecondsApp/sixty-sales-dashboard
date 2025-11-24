-- Create scheduled_emails table for email scheduling functionality
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email details
  to_email TEXT NOT NULL,
  cc_email TEXT,
  bcc_email TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

  -- Metadata
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Optional associations
  reply_to_message_id TEXT,
  thread_id TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_id ON scheduled_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for ON scheduled_emails(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user_status ON scheduled_emails(user_id, status);

-- RLS policies
ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scheduled emails
CREATE POLICY "Users can view own scheduled emails"
  ON scheduled_emails
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own scheduled emails
CREATE POLICY "Users can create own scheduled emails"
  ON scheduled_emails
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scheduled emails (to cancel, etc.)
CREATE POLICY "Users can update own scheduled emails"
  ON scheduled_emails
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own scheduled emails
CREATE POLICY "Users can delete own scheduled emails"
  ON scheduled_emails
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_scheduled_emails_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER scheduled_emails_updated_at
  BEFORE UPDATE ON scheduled_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_emails_updated_at();
