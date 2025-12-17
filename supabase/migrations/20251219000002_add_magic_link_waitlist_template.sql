-- ============================================================================
-- ADD MAGIC LINK WAITLIST EMAIL TEMPLATE
-- Template for sending magic links to waitlist users to create their accounts
-- Uses encharge_email_templates table, same as waitlist_welcome template
-- ============================================================================

-- Insert magic link waitlist template
INSERT INTO encharge_email_templates (template_name, template_type, subject_line, html_body, text_body, variables, is_active) VALUES
  (
    'Magic Link - Early Access',
    'magic_link_waitlist',
    'Welcome to Early Access! 🎉',
    '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Early Access - use60</title>
</head>
<body style="margin: 0; padding: 0; background-color: #111111; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111111;">
    <tr>
      <td align="center" style="padding: 48px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);">
          <tr>
            <td style="height: 6px; background-color: #37bd7e; border-radius: 16px 16px 0 0;"></td>
          </tr>
          <tr>
            <td align="center" style="padding: 40px 40px 24px 40px; background-color: #ffffff;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #111111; letter-spacing: -0.5px;">use60</h1>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280; font-weight: 500;">AI Sales Assistant</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 40px 40px; background-color: #ffffff;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #111111; text-align: center;">Welcome to Early Access! 🎉</h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #4b5563; text-align: center;">
                Your account is ready! Click the button below to set up your password and start using AI-powered sales intelligence.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="{{magic_link_url}}" style="display: inline-block; padding: 14px 56px; background-color: #37bd7e; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">Get Started</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
                Or copy this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #37bd7e; text-align: center; word-break: break-all; background-color: #f3f4f6; padding: 12px 16px; border-radius: 8px;">
                {{magic_link_url}}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 32px;">
                <tr>
                  <td style="padding: 24px; background-color: #f9fafb; border-radius: 12px;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #111111; text-align: center;">WHAT YOU''LL GET:</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                            <span style="color: #37bd7e; font-weight: 600;">✓</span> AI Meeting Notes - Automatic transcription & summaries
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                            <span style="color: #37bd7e; font-weight: 600;">✓</span> Smart CRM Sync - Auto-update deals after every call
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                            <span style="color: #37bd7e; font-weight: 600;">✓</span> Action Items - Never miss a follow-up again
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 32px 40px; background-color: #ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fffbeb; border-radius: 10px; border: 1px solid #fde68a;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="32" valign="top" style="padding-top: 1px;">
                          <div style="width: 22px; height: 22px; background-color: #f59e0b; border-radius: 50%; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; color: #ffffff;">!</div>
                        </td>
                        <td style="font-size: 13px; color: #92400e; line-height: 1.5;">
                          <strong>Security notice:</strong> This link expires in 24 hours and can only be used once. If you didn''t request access, you can safely ignore this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px 28px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-align: center;">
                © 2025 Sixty seconds Ltd - 60 AI Sales Assistant
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    'Welcome to Early Access!

Your account is ready! Click the link below to set up your password and start using AI-powered sales intelligence.

{{magic_link_url}}

WHAT YOU''LL GET:
✓ AI Meeting Notes - Automatic transcription & summaries
✓ Smart CRM Sync - Auto-update deals after every call
✓ Action Items - Never miss a follow-up again

Security notice: This link expires in 24 hours and can only be used once.

© 2025 Sixty seconds Ltd - 60 AI Sales Assistant',
    '{"magic_link_url": "magic_link_url", "user_name": "user_name", "user_email": "user_email"}'::jsonb,
    true
  )
ON CONFLICT (template_name) DO UPDATE
SET
  template_type = EXCLUDED.template_type,
  subject_line = EXCLUDED.subject_line,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMENT ON TABLE encharge_email_templates IS 'Email templates used by encharge-send-email Edge Function. Templates support {{variable}} replacement.';
