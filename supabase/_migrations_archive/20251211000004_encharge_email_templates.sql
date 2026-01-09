-- ============================================================================
-- ENCHARGE EMAIL TEMPLATES TABLE
-- Store HTML email templates for Encharge email journeys
-- Templates are managed programmatically, no Encharge UI needed
-- ============================================================================

CREATE TABLE IF NOT EXISTS encharge_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL, -- 'welcome', 'trial_ending', etc.
  subject_line TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT, -- Plain text fallback
  variables JSONB DEFAULT '{}'::jsonb, -- Available variables: {{user_name}}, {{days_remaining}}, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encharge_templates_type ON encharge_email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_encharge_templates_active ON encharge_email_templates(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE encharge_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encharge_templates_admin_select" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_insert" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_update" ON encharge_email_templates;
DROP POLICY IF EXISTS "encharge_templates_admin_delete" ON encharge_email_templates;

CREATE POLICY "encharge_templates_admin_select" ON encharge_email_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "encharge_templates_admin_insert" ON encharge_email_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "encharge_templates_admin_update" ON encharge_email_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "encharge_templates_admin_delete" ON encharge_email_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Insert default templates
INSERT INTO encharge_email_templates (template_name, template_type, subject_line, html_body, text_body, variables) VALUES
  (
    'Welcome to Sixty',
    'welcome',
    'Welcome to Sixty Seconds! 🎉',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Sixty Seconds</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #37bd7e 0%, #2d9a64 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Sixty Seconds</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #2d3748; font-size: 20px; margin-top: 0;">Welcome, {{user_name}}! 👋</h2>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 16px;">
        We''re thrilled to have you join Sixty Seconds! Your meeting intelligence platform is ready to help you close more deals.
      </p>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 24px;">
        Here''s what you can do next:
      </p>
      <ul style="color: #4a5568; line-height: 1.8; margin-bottom: 24px;">
        <li>Connect your Fathom account to sync your meetings</li>
        <li>Explore AI-powered meeting summaries and insights</li>
        <li>Generate proposals directly from your conversations</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.sixtyseconds.ai/onboarding" style="display: inline-block; padding: 12px 24px; background-color: #37bd7e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Get Started</a>
      </div>
    </div>
    <div style="background-color: #f7fafc; padding: 20px 30px; text-align: center; font-size: 14px; color: #718096; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0;">Sent by Sixty Seconds Workflows</p>
    </div>
  </div>
</body>
</html>',
    'Welcome to Sixty Seconds!\n\nWe''re thrilled to have you join! Your meeting intelligence platform is ready.\n\nGet started: https://app.sixtyseconds.ai/onboarding',
    '{"user_name": "User''s first name"}'
  ),
  (
    'Trial Ending Soon',
    'trial_ending',
    'Your trial ends in {{days_remaining}} days',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #37bd7e 0%, #2d9a64 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Sixty Seconds</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #2d3748; font-size: 20px; margin-top: 0;">Hi {{user_name}},</h2>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 16px;">
        Your free trial ends in <strong>{{days_remaining}} days</strong> ({{trial_end_date}}).
      </p>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 24px;">
        Don''t lose access to your meeting insights! Add a payment method to continue using Sixty Seconds.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.sixtyseconds.ai/team/billing" style="display: inline-block; padding: 12px 24px; background-color: #37bd7e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Add Payment Method</a>
      </div>
    </div>
    <div style="background-color: #f7fafc; padding: 20px 30px; text-align: center; font-size: 14px; color: #718096; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0;">Sent by Sixty Seconds Workflows</p>
    </div>
  </div>
</body>
</html>',
    'Hi {{user_name}},\n\nYour free trial ends in {{days_remaining}} days ({{trial_end_date}}).\n\nAdd payment method: https://app.sixtyseconds.ai/team/billing',
    '{"user_name": "User''s first name", "days_remaining": "Number of days", "trial_end_date": "Formatted date"}'
  ),
  (
    'Trial Expired',
    'trial_expired',
    'Your trial has ended - We miss you!',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #37bd7e 0%, #2d9a64 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Sixty Seconds</h1>
    </div>
    <div style="padding: 40px 30px;">
      <h2 style="color: #2d3748; font-size: 20px; margin-top: 0;">We miss you, {{user_name}}!</h2>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 16px;">
        Your trial has ended, but your meeting insights are still here waiting for you.
      </p>
      <p style="color: #4a5568; line-height: 1.6; margin-bottom: 24px;">
        Continue your journey with Sixty Seconds and unlock the full power of meeting intelligence.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.sixtyseconds.ai/team/billing" style="display: inline-block; padding: 12px 24px; background-color: #37bd7e; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Upgrade Now</a>
      </div>
    </div>
    <div style="background-color: #f7fafc; padding: 20px 30px; text-align: center; font-size: 14px; color: #718096; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0;">Sent by Sixty Seconds Workflows</p>
    </div>
  </div>
</body>
</html>',
    'Hi {{user_name}},\n\nYour trial has ended. Continue your journey: https://app.sixtyseconds.ai/team/billing',
    '{"user_name": "User''s first name"}'
  )
ON CONFLICT (template_name) DO NOTHING;

COMMENT ON TABLE encharge_email_templates IS 'Email templates for Encharge journeys - managed programmatically';
COMMENT ON COLUMN encharge_email_templates.variables IS 'JSON object describing available template variables';
