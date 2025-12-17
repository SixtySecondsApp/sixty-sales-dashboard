-- ============================================================================
-- UPDATE MAGIC LINK WAITLIST EMAIL TEMPLATE - MATCH WAITLIST WELCOME STYLING
-- Updates the magic link template to use the same dark mode styling as waitlist_welcome
-- ============================================================================

-- Update magic link waitlist template with dark mode styling matching waitlist_welcome
UPDATE encharge_email_templates
SET
  html_body = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to Early Access</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Base styles - Desktop */
    html { 
      color-scheme: light !important; 
      background-color: #030712 !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
    }
    body { 
      color-scheme: light !important; 
      background-color: #030712 !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      -webkit-text-fill-color: #F3F4F6 !important;
      font-family: ''Inter'', -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif;
    }
    
    /* Desktop: Prevent dark mode auto-inversion */
    * { 
      color-scheme: light !important;
      forced-color-adjust: none !important;
    }
    
    /* Gmail Dark Mode Prevention */
    u + .body .gmail-blend-screen,
    u + .body .gmail-blend-difference,
    .msg-html-content,
    .msg-html-content *,
    [data-ogsc] .msg-html-content,
    [data-ogsc] .msg-html-content * {
      background-color: #111827 !important;
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
      forced-color-adjust: none !important;
    }
    
    u + .body {
      background-color: #111827 !important;
      color-scheme: light !important;
    }
    
    /* Gmail iOS specific fixes */
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
      .msg-html-content,
      .msg-html-content table,
      .msg-html-content td {
        background-color: #111827 !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      .msg-html-content h1,
      .msg-html-content h2,
      .msg-html-content h3,
      .msg-html-content .email-title {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      .msg-html-content p,
      .msg-html-content .email-welcome-text,
      .msg-html-content .email-list-text {
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
    }
    
    /* Mobile Styles */
    @media only screen and (max-width: 600px) {
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background-color: #111827 !important;
        color-scheme: dark !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        border-radius: 0 !important;
        background-color: #111827 !important;
      }
      
      .email-header {
        padding: 32px 20px 24px !important;
        background-color: #111827 !important;
        background: linear-gradient(135deg, #111827 0%, #1F2937 100%) !important;
      }
      
      .email-title {
        font-size: 24px !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      .email-content {
        padding: 24px 20px !important;
        background-color: #111827 !important;
      }
      
      .email-welcome-text {
        font-size: 15px !important;
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
      
      .email-list-text {
        font-size: 13px !important;
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
    }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; font-family: ''Inter'', -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #030712 !important; -webkit-font-smoothing: antialiased; color-scheme: light !important; forced-color-adjust: none !important; -webkit-text-fill-color: #FFFFFF !important; color: #FFFFFF !important; width: 100% !important;">
  <div style="background-color: #111827 !important; min-height: 100vh; width: 100% !important; margin: 0 !important; padding: 0 !important;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #030712 !important; padding: 0; margin: 0 auto; width: 100% !important;">
    <tr style="background-color: #030712 !important;">
      <td align="center" style="padding: 20px 0; background-color: #030712 !important;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #111827 !important; border-radius: 16px; overflow: hidden; border: 1px solid #374151 !important;">
          <!-- Header with Logo -->
          <tr style="background-color: #111827 !important;">
            <td class="email-header" style="padding: 48px 40px 32px; text-align: center; background-color: #111827 !important; background: linear-gradient(135deg, #111827 0%, #1F2937 100%) !important;">
              <img src="https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/Icon.png" alt="use60" width="80" height="80" class="email-logo" style="display: block; margin: 0 auto 24px; border: 0; max-width: 80px; width: 80px; height: auto;" />
              <h1 class="email-title" style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; font-size: 28px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.2; letter-spacing: -0.02em;">Welcome to Early Access! 🎉</h1>
              <p class="email-subtitle" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 18px; margin: 0; line-height: 1.5; font-weight: 400;">Your account is ready!</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr style="background-color: #111827 !important;">
            <td class="email-content" style="padding: 40px 40px; background-color: #111827 !important;">
              <!-- Welcome Message -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td>
                    <p class="email-welcome-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0; text-align: center;">Click the button below to set up your password and start using AI-powered sales intelligence.</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <a href="{{magic_link_url}}" class="email-button" style="display: inline-block; padding: 14px 32px; background-color: #10B981 !important; background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">Get Started</a>
                  </td>
                </tr>
              </table>
              
              <!-- Link fallback -->
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #9CA3AF !important; text-align: center;">Or copy this link into your browser:</p>
              <p style="margin: 0 0 32px 0; font-size: 12px; color: #10B981 !important; text-align: center; word-break: break-all; background-color: #1F2937 !important; padding: 12px 16px; border-radius: 8px;">{{magic_link_url}}</p>
              
              <!-- What You''ll Get Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px; background-color: #1F2937 !important; border-radius: 12px; padding: 24px;">
                <tr>
                  <td>
                    <h3 class="email-section-title" style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 20px 0; text-align: center;">WHAT YOU''LL GET:</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td class="email-list-item" style="padding-bottom: 16px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px;">
                                <span style="color: #10B981 !important; font-size: 18px; font-weight: bold;">✓</span>
                              </td>
                              <td valign="top">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0;">AI Meeting Notes - Automatic transcription & summaries</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td class="email-list-item" style="padding-bottom: 16px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px;">
                                <span style="color: #10B981 !important; font-size: 18px; font-weight: bold;">✓</span>
                              </td>
                              <td valign="top">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0;">Smart CRM Sync - Auto-update deals after every call</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px;">
                                <span style="color: #10B981 !important; font-size: 18px; font-weight: bold;">✓</span>
                              </td>
                              <td valign="top">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0;">Action Items - Never miss a follow-up again</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Security Notice -->
          <tr style="background-color: #111827 !important;">
            <td style="padding: 0 40px 32px 40px; background-color: #111827 !important;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1F2937 !important; border-radius: 10px; border: 1px solid #374151 !important;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="32" valign="top" style="padding-top: 1px;">
                          <div style="width: 22px; height: 22px; background-color: #10B981; border-radius: 50%; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; color: #FFFFFF;">!</div>
                        </td>
                        <td style="font-size: 13px; color: #D1D5DB !important; line-height: 1.5;">
                          <strong>Security notice:</strong> This link expires in 24 hours and can only be used once. If you didn''t request access, you can safely ignore this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr style="background-color: #111827 !important;">
            <td class="email-footer" style="padding: 24px 40px; text-align: center; background-color: #111827 !important; border-top: 1px solid #374151 !important;">
              <p class="email-footer-text" style="color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important; font-size: 14px; margin: 0 0 8px 0; font-weight: 500; line-height: 1.4;">© 2025 Sixty seconds Ltd - 60 AI Sales Assistant</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  </div>
</body>
</html>',
  text_body = 'Welcome to Early Access! 🎉

Your account is ready! Click the link below to set up your password and start using AI-powered sales intelligence.

{{magic_link_url}}

WHAT YOU''LL GET:
✓ AI Meeting Notes - Automatic transcription & summaries
✓ Smart CRM Sync - Auto-update deals after every call
✓ Action Items - Never miss a follow-up again

Security notice: This link expires in 24 hours and can only be used once.

© 2025 Sixty seconds Ltd - 60 AI Sales Assistant',
  updated_at = NOW()
WHERE template_type = 'magic_link_waitlist';

COMMENT ON TABLE encharge_email_templates IS 'Email templates used by encharge-send-email Edge Function. Templates support {{variable}} replacement.';

