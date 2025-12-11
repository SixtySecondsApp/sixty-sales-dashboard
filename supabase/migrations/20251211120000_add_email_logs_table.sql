-- Email Logs Table
-- Tracks all emails sent via Encharge for debugging and analytics

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered, opened, clicked
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_via TEXT DEFAULT 'encharge', -- encharge, ses, resend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "email_logs_service_role" ON email_logs
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Platform admins can view all logs
CREATE POLICY "email_logs_admin_select" ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Users can view their own email logs
CREATE POLICY "email_logs_user_select" ON email_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Add comment
COMMENT ON TABLE email_logs IS 'Logs all transactional and marketing emails sent via Encharge.io';
