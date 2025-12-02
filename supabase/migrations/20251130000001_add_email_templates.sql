-- Waitlist Email Templates System
-- Allows admins to customize waitlist invitation emails with variable placeholders
-- Note: Renamed from 'email_templates' to avoid conflict with existing MCP email templates table

CREATE TABLE waitlist_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('access_grant', 'reminder', 'welcome')),
  description TEXT,
  subject_line TEXT NOT NULL,
  email_body TEXT NOT NULL, -- HTML with {{placeholders}}
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one default template per type
CREATE UNIQUE INDEX idx_waitlist_email_templates_default_per_type
ON waitlist_email_templates(template_type) WHERE is_default = true;

-- Index for efficient queries
CREATE INDEX idx_waitlist_email_templates_type ON waitlist_email_templates(template_type);
CREATE INDEX idx_waitlist_email_templates_active ON waitlist_email_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE waitlist_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only admins can view/manage waitlist email templates
CREATE POLICY "Admins can view waitlist email templates"
ON waitlist_email_templates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can insert waitlist email templates"
ON waitlist_email_templates FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update waitlist email templates"
ON waitlist_email_templates FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can delete waitlist email templates"
ON waitlist_email_templates FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_waitlist_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER waitlist_email_templates_updated_at
BEFORE UPDATE ON waitlist_email_templates
FOR EACH ROW
EXECUTE FUNCTION update_waitlist_email_template_timestamp();

-- Seed default "Access Grant" email template
INSERT INTO waitlist_email_templates (
  template_name,
  template_type,
  subject_line,
  email_body,
  description,
  is_default,
  is_active
) VALUES (
  'Default Access Grant',
  'access_grant',
  'Welcome to Meeting Intelligence - Your Access is Ready! 🎉',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Meeting Intelligence</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .header p {
      color: #666;
      font-size: 16px;
      margin: 0;
    }
    .content {
      color: #333;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #2563eb;
    }
    .features {
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
    }
    .features h3 {
      color: #1a1a1a;
      font-size: 18px;
      margin: 0 0 15px 0;
    }
    .features ul {
      margin: 0;
      padding-left: 20px;
    }
    .features li {
      margin: 8px 0;
      color: #555;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .expiry-notice {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🎉 Welcome to Meeting Intelligence!</h1>
      <p>Your exclusive access is ready</p>
    </div>

    <div class="content">
      <p>Hi {{user_name}},</p>

      <p>Great news! You''ve been granted access to Meeting Intelligence. We''re excited to have you join us from <strong>{{company_name}}</strong>.</p>

      <p style="text-align: center;">
        <a href="{{magic_link}}" class="cta-button">
          🚀 Activate Your Account
        </a>
      </p>

      <div class="expiry-notice">
        ⏰ <strong>Important:</strong> This magic link expires on {{expiry_date}}. Click above to set up your account.
      </div>

      <div class="features">
        <h3>What you''ll get access to:</h3>
        <ul>
          <li>🎙️ <strong>AI-Powered Meeting Intelligence</strong> - Automatically transcribe and analyze your meetings</li>
          <li>📊 <strong>Smart CRM Integration</strong> - Seamlessly sync with your existing workflow</li>
          <li>🎯 <strong>Actionable Insights</strong> - Get AI-generated summaries and action items</li>
          <li>🔍 <strong>Semantic Search</strong> - Find any discussion across all your meetings instantly</li>
          <li>👥 <strong>Team Collaboration</strong> - Share insights and collaborate with your team</li>
          <li>📈 <strong>Analytics Dashboard</strong> - Track engagement and meeting effectiveness</li>
        </ul>
      </div>

      <p>Your unique referral code is: <strong>{{referral_code}}</strong></p>
      <p>Share it with colleagues to move up the waitlist and unlock rewards!</p>

      {{#if custom_message}}
      <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af;"><strong>Personal note from {{admin_name}}:</strong></p>
        <p style="margin: 8px 0 0 0; color: #1e3a8a;">{{custom_message}}</p>
      </div>
      {{/if}}

      <p>If you have any questions, just reply to this email. We''re here to help!</p>

      <p>Looking forward to seeing you inside,<br>
      <strong>The Meeting Intelligence Team</strong></p>
    </div>

    <div class="footer">
      <p>You''re receiving this email because you''re on the Meeting Intelligence waitlist.</p>
      <p>Current position: #{{waitlist_position}} | Invited on {{current_date}}</p>
    </div>
  </div>
</body>
</html>',
  'Default template for granting waitlist access with magic link authentication',
  true,
  true
);

-- Seed default "Reminder" email template
INSERT INTO waitlist_email_templates (
  template_name,
  template_type,
  subject_line,
  email_body,
  description,
  is_default,
  is_active
) VALUES (
  'Default Access Reminder',
  'reminder',
  'Reminder: Your Meeting Intelligence Access is Waiting! ⏰',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Reminder</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 26px;
      margin: 0 0 10px 0;
    }
    .content {
      color: #333;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background-color: #f59e0b;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
      text-align: center;
    }
    .urgent-notice {
      background-color: #fef3c7;
      border: 2px solid #f59e0b;
      padding: 16px 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>⏰ Your Access Link is Expiring Soon</h1>
    </div>

    <div class="content">
      <p>Hi {{user_name}},</p>

      <p>We noticed you haven''t activated your Meeting Intelligence account yet. Your exclusive access link expires on <strong>{{expiry_date}}</strong>.</p>

      <div class="urgent-notice">
        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #92400e;">
          ⚠️ Don''t miss out! Activate within {{days_remaining}} days
        </p>
      </div>

      <p style="text-align: center;">
        <a href="{{magic_link}}" class="cta-button">
          🚀 Activate Now
        </a>
      </p>

      <p>Need help getting started? Reply to this email and we''ll assist you right away.</p>

      <p>Best regards,<br>
      <strong>The Meeting Intelligence Team</strong></p>
    </div>

    <div class="footer">
      <p>You received this reminder because your access link hasn''t been used yet.</p>
    </div>
  </div>
</body>
</html>',
  'Reminder template for users who haven''t activated their access',
  true,
  true
);

-- Seed default "Welcome" email template (for after account creation)
INSERT INTO waitlist_email_templates (
  template_name,
  template_type,
  subject_line,
  email_body,
  description,
  is_default,
  is_active
) VALUES (
  'Default Welcome Message',
  'welcome',
  'Welcome Aboard! Let''s Get You Started 👋',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 28px;
      margin: 0 0 10px 0;
    }
    .content {
      color: #333;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background-color: #10b981;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 30px 0;
      text-align: center;
    }
    .steps {
      background-color: #f0fdf4;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
    }
    .steps h3 {
      color: #1a1a1a;
      font-size: 18px;
      margin: 0 0 15px 0;
    }
    .steps ol {
      margin: 0;
      padding-left: 20px;
    }
    .steps li {
      margin: 12px 0;
      color: #555;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>👋 Welcome, {{user_name}}!</h1>
      <p>Your account is active and ready to go</p>
    </div>

    <div class="content">
      <p>Congratulations on joining Meeting Intelligence! We''re thrilled to have you from <strong>{{company_name}}</strong>.</p>

      <div class="steps">
        <h3>🚀 Quick Start Guide:</h3>
        <ol>
          <li><strong>Complete Your Profile</strong> - Add your details and preferences</li>
          <li><strong>Connect Your Calendar</strong> - Sync your first meeting</li>
          <li><strong>Try AI Search</strong> - Experience semantic meeting search</li>
          <li><strong>Integrate Your CRM</strong> - Connect your sales tools</li>
          <li><strong>Invite Your Team</strong> - Collaborate with colleagues</li>
        </ol>
      </div>

      <p style="text-align: center;">
        <a href="https://app.meetingintelligence.com/onboarding" class="cta-button">
          ✨ Start Onboarding
        </a>
      </p>

      <p>Your referral code: <strong>{{referral_code}}</strong><br>
      Share it with colleagues to unlock rewards!</p>

      <p>Questions? We''re here to help. Just reply to this email.</p>

      <p>Happy meeting analyzing!<br>
      <strong>The Meeting Intelligence Team</strong></p>
    </div>

    <div class="footer">
      <p>Account created on {{current_date}}</p>
    </div>
  </div>
</body>
</html>',
  'Welcome template sent after account activation',
  true,
  true
);

-- Create function to get default waitlist email template for a type
CREATE OR REPLACE FUNCTION get_default_waitlist_email_template(p_template_type TEXT)
RETURNS waitlist_email_templates AS $$
DECLARE
  template_record waitlist_email_templates;
BEGIN
  SELECT * INTO template_record
  FROM waitlist_email_templates
  WHERE template_type = p_template_type
    AND is_default = true
    AND is_active = true
  LIMIT 1;

  RETURN template_record;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE waitlist_email_templates IS 'Customizable email templates for waitlist invitations and user communications';
COMMENT ON COLUMN waitlist_email_templates.template_type IS 'Type of template: access_grant, reminder, or welcome';
COMMENT ON COLUMN waitlist_email_templates.email_body IS 'HTML email body with {{variable}} placeholders for dynamic content';
COMMENT ON COLUMN waitlist_email_templates.is_default IS 'Only one default template per type allowed';
